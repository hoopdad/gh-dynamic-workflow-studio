#Requires -Version 7.2
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$TestRunId,
    [Parameter(Mandatory)][string]$ManifestPath,
    [ValidateSet('Inspect', 'Apply')][string]$Mode = 'Inspect',
    [ValidateSet('Inventory', 'Reset', 'Bootstrap', 'Issues', 'Preflight')][string]$Stage = 'Inventory',
    [string]$ConfigurationPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LabDeliveryTest.psm1') -DisableNameChecking

if (Test-Path -LiteralPath $ManifestPath) {
    $manifest = Read-LabManifest $TestRunId $ManifestPath
} elseif ($ConfigurationPath) {
    $manifest = Get-Content -LiteralPath $ConfigurationPath -Raw | ConvertFrom-Json -AsHashtable
    Assert-LabManifest $manifest $TestRunId $ManifestPath
} else { throw 'First inventory requires an explicit private configuration file' }

$lock = $null
$oldAzure = $env:AZURE_CONFIG_DIR
$oldExtensionInstall = $env:AZURE_EXTENSION_USE_DYNAMIC_INSTALL
try {
    if ($Mode -eq 'Apply' -and -not $WhatIfPreference) {
        [void][IO.Directory]::CreateDirectory($manifest.evidenceRoot)
        $lock = [IO.File]::Open("$ManifestPath.lock", 'OpenOrCreate', 'ReadWrite', 'None')
    }
    Assert-LabRepository $manifest
    $package = Assert-LabPinnedSource $manifest
    if ($Stage -eq 'Inventory') {
        Set-LabAzureScope $manifest
        $runs = Invoke-LabCommand node @((Join-Path $PSScriptRoot 'observe-runs.mjs'), $manifest.sourceRoot, $manifest.repositoryRoot) |
            ConvertFrom-Json -AsHashtable
        $shared = @(Get-LabSharedBaseline $manifest)
        $resources = Invoke-LabCommand az @('resource', 'list', '--subscription', $manifest.subscriptionId,
            '--query', '[].{id:id,type:type,location:location,resourceGroup:resourceGroup,tags:tags}',
            '-o', 'json', '--only-show-errors') | ConvertFrom-Json -AsHashtable
        $issues = Invoke-LabCommand gh @('api', '--paginate', '--slurp',
            "repos/$($manifest.repository)/issues?state=all&per_page=100") | ConvertFrom-Json -AsHashtable
        $issueList = @($issues | ForEach-Object { $_ } | Where-Object { -not $_.Contains('pull_request') })
        $pulls = Invoke-LabCommand gh @('pr', 'list', '--repo', $manifest.repository, '--state', 'open',
            '--limit', '1000', '--json', 'number,url,headRefName,headRefOid,baseRefName') | ConvertFrom-Json -AsHashtable
        $branches = @()
        $localRefs = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'for-each-ref',
            '--format=%(refname:short) %(objectname)', 'refs/heads')
        foreach ($ref in ($localRefs -split '\r?\n')) {
            $parts = $ref -split ' ', 2
            if ($parts[0] -cne $manifest.defaultBranch) { $branches += @{ name = $parts[0]; sha = $parts[1]; remote = $false } }
        }
        $remoteRefs = Invoke-LabCommand gh @('api', '--paginate', '--slurp',
            "repos/$($manifest.repository)/branches?per_page=100") | ConvertFrom-Json -AsHashtable
        foreach ($ref in @($remoteRefs | ForEach-Object { $_ })) {
            if ($ref.name -cne $manifest.defaultBranch) { $branches += @{ name = $ref.name; sha = $ref.commit.sha; remote = $true } }
        }
        $files = @()
        $names = @(
            Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'ls-files', '-co', '--exclude-standard', '-z')
            Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z')
        ) -join [char]0
        foreach ($name in @($names.Split([char]0) | Where-Object { $_ } | Sort-Object -Unique)) {
            $file = Join-Path $manifest.repositoryRoot $name
            Assert-LabUnlinkedPath $file
            if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Non-file reset candidate: $name" }
            $files += @{ path = $name; sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
        }
        $trees = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'worktree', 'list', '--porcelain')
        $worktrees = @(Get-LabDisposableWorktrees $manifest.repositoryRoot $trees)
        $stateFiles = @()
        foreach ($root in @($manifest.repositoryRoot) + @($worktrees | ForEach-Object path)) {
            $stateFiles += @(Get-ChildItem -LiteralPath $root -File -Recurse -Force |
                Where-Object { $_.Name -match '\.tfstate(\.backup)?$' } |
                ForEach-Object { @{ path = $_.FullName; sha256 = (Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant() } })
        }
        $baselineSha = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'rev-parse', 'HEAD')
        $diagnostics = @($issueList | ForEach-Object { @{ number = $_.number; nodeId = $_.node_id
            title = $_.title; state = $_.state; url = $_.html_url; labels = @($_.labels | ForEach-Object name) } })
        $snapshot = @{ testRunId = $TestRunId; sourceRevision = $manifest.sourceRevision; baselineSha = $baselineSha
            observedAt = [DateTime]::UtcNow.ToString('o'); runs = $runs; shared = $shared; resources = $resources
            previousIssues = $diagnostics; previousPullRequests = @($pulls); branches = $branches
            worktrees = $worktrees; stateFiles = $stateFiles }
        if ($Mode -eq 'Apply' -and $PSCmdlet.ShouldProcess($ManifestPath, 'Persist nonsecret inventory; no repository/GitHub/Azure mutations')) {
            if ($manifest.Contains('inventoryPath')) { throw 'Inventory already captured; preserve it and create an explicit new observation instead of overwriting ownership' }
            $manifest.inventoryPath = Join-Path $manifest.evidenceRoot 'baseline.json'
            Write-LabJson $manifest.inventoryPath $snapshot
            $manifest.previous.baselineSha = $baselineSha
            $manifest.previous.files = $files
            $manifest.previous.worktrees = $worktrees
            $manifest.previous.issues = @($diagnostics | ForEach-Object { @{ number = $_.number; nodeId = $_.nodeId } })
            $manifest.previous.branches = $branches
            $manifest.previous.pullRequests = @($pulls)
            $manifest.previous.diagnosticsPreserved = $true
            $manifest.baselineResourceIds = @($resources | ForEach-Object id)
            $manifest.runtimeHashes = Get-LabRuntimeHashes $package
            $manifest.initialIssues = @()
            $manifest.stages = @{ reset = $false; bootstrap = $false; issues = $false }
            $manifest.delivery = @{ started = $false; stopped = $true; ownershipPath = (Join-Path $manifest.evidenceRoot 'ownership.json') }
            $manifest.modelAttempts = @{ count = 0; evidence = 'No new delivery/model invocation started' }
            foreach ($relative in @('.github\workflow-fixes.md', 'tests\workflow-requirements.test.mjs', 'tests\workflow-worktrees.test.mjs',
                '.github\extensions\issue-driven-delivery\workflow.mjs', '.github\extensions\issue-driven-delivery\extension.mjs')) {
                $file = Join-Path $manifest.repositoryRoot $relative
                if (Test-Path -LiteralPath $file -PathType Leaf) {
                    $destination = Join-Path $manifest.evidenceRoot (Join-Path 'previous-source' $relative)
                    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
                    Copy-Item -LiteralPath $file -Destination $destination -ErrorAction Stop
                }
            }
            Write-LabJson $ManifestPath $manifest
        }
        @{ stage = $Stage; mode = $Mode; snapshot = $snapshot; destructiveEffects = @() } | ConvertTo-Json -Depth 30
        return
    }

    if (-not $manifest.Contains('inventoryPath')) { throw 'Capture the private baseline first' }
    if ($Stage -eq 'Preflight') {
        [void](Assert-LabQuiescent $manifest -CurrentRunOnly)
        $shared = @(Assert-LabPrerequisites $manifest)
        @{ stage = $Stage; status = 'ready'; shared = $shared; deploymentStarted = $false } | ConvertTo-Json -Depth 30
        return
    }
    [void](Assert-LabQuiescent $manifest)
    if ($Stage -eq 'Reset') {
        $plan = @(Get-LabResetPlan $manifest)
        if ($manifest.stages.reset) {
            @{ stage = $Stage; status = 'unchanged'; baseline = $manifest.resetCommit } | ConvertTo-Json
            return
        }
        $head = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'rev-parse', 'HEAD')
        $branch = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'branch', '--show-current')
        if ($head -cne $manifest.previous.baselineSha -or $branch -cne $manifest.defaultBranch) { throw 'Reset baseline/default branch moved' }
        foreach ($item in $plan | Where-Object kind -eq 'file') {
            $file = Join-Path $manifest.repositoryRoot $item.path
            if (Test-Path -LiteralPath $file) {
                if ((Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant() -cne $item.sha256) { throw "Reset file changed: $($item.path)" }
            }
        }
        if ($Mode -eq 'Apply' -and $PSCmdlet.ShouldProcess($manifest.repositoryRoot, 'Reset only enumerated previous-test files/worktrees/branches/issues, preserving Git history')) {
            foreach ($item in $plan | Where-Object kind -eq 'worktree') {
                if (-not (Test-Path -LiteralPath $item.path)) { continue }
                $actual = Invoke-LabCommand git @('-C', $item.path, 'rev-parse', 'HEAD')
                if ($actual -cne $item.head) { throw 'Disposable worktree moved' }
                $state = @(Get-ChildItem -LiteralPath $item.path -File -Recurse -Force |
                    Where-Object { $_.Name -match '\.tfstate(\.backup)?$' })
                if ($state.Count) { throw 'State-bearing worktree must be reconciled by its original deployment owner' }
                [void](Invoke-LabCommand git @('-c', 'core.longpaths=true', '-C', $manifest.repositoryRoot,
                    'worktree', 'remove', '--force', $item.path))
            }
            foreach ($item in $plan | Where-Object kind -eq 'branch') {
                if ($item.remote) {
                    $refs = Invoke-LabCommand gh @('api', "repos/$($manifest.repository)/git/matching-refs/heads/$($item.name)") |
                        ConvertFrom-Json -AsHashtable
                    $ref = @($refs | Where-Object { $_.ref -ceq "refs/heads/$($item.name)" })
                    if (-not $ref.Count) { continue }
                    if ($ref.Count -ne 1 -or $ref[0].object.sha -cne $item.sha) { throw 'Remote branch changed' }
                    [void](Invoke-LabCommand gh @('api', '--method', 'DELETE', "repos/$($manifest.repository)/git/refs/heads/$($item.name)"))
                } else {
                    $refs = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'for-each-ref', '--format=%(objectname)', "refs/heads/$($item.name)")
                    if (-not $refs) { continue }
                    if ($refs -cne $item.sha) { throw 'Local branch changed' }
                    [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'branch', '-D', $item.name))
                }
            }
            foreach ($item in $plan | Where-Object kind -eq 'issue') {
                $query = 'query($id:ID!){node(id:$id){... on Issue{id number repository{nameWithOwner}}}}'
                $found = Invoke-LabCommand gh @('api', 'graphql', '-f', "query=$query", '-f', "id=$($item.nodeId)") |
                    ConvertFrom-Json -AsHashtable
                if ($null -eq $found.data.node) { continue }
                if ($found.data.node.repository.nameWithOwner -cne $manifest.repository -or
                    $found.data.node.number -ne $item.number) { throw 'Old issue identity changed' }
                [void](Invoke-LabCommand gh @('issue', 'delete', "$($item.number)", '--repo', $manifest.repository, '--yes'))
            }
            foreach ($item in $plan | Where-Object kind -eq 'file') {
                $file = Join-Path $manifest.repositoryRoot $item.path
                if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
            }
            $installed = Join-Path $manifest.repositoryRoot '.github\extensions\issue-driven-delivery'
            if (Test-Path -LiteralPath $installed) {
                if (@(Get-ChildItem -LiteralPath $installed -Force).Count) { throw 'Unexpected installed runtime files remain' }
                Remove-Item -LiteralPath $installed
            }
            [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'add', '--update'))
            $pending = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'diff', '--cached', '--name-only')
            if ($pending) {
                [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'commit', '-m', "Reset previous disposable delivery test ($TestRunId)",
                    '-m', "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`nCopilot-Session: $($manifest.supervisorSessionId)"))
            }
            $manifest.resetCommit = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'rev-parse', 'HEAD')
            $manifest.stages.reset = $true
            Write-LabJson $ManifestPath $manifest
        }
        @{ stage = $Stage; mode = $Mode; plan = $plan } | ConvertTo-Json -Depth 10
        return
    }

    if (-not $manifest.stages.reset) { throw 'Scoped reset must complete before bootstrap/issues' }
    if ($Stage -eq 'Bootstrap') {
        if ($manifest.stages.bootstrap) {
            $actual = Get-LabRuntimeHashes (Join-Path $manifest.repositoryRoot '.github\extensions\issue-driven-delivery')
            if (($actual | ConvertTo-Json -Compress) -cne ($manifest.runtimeHashes | ConvertTo-Json -Compress)) { throw 'Installed runtime drift' }
            @{ stage = $Stage; status = 'unchanged'; runtimeHashes = $actual } | ConvertTo-Json
            return
        }
        $remaining = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'ls-files', '--cached', '--others', '--exclude-standard')
        $ignored = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'ls-files', '--others', '--ignored', '--exclude-standard')
        if ($remaining -or $ignored) { throw 'Non-bootstrap files remain after reset; inventory/reconcile exact paths rather than leaking old inputs' }
        if ($Mode -eq 'Apply' -and $PSCmdlet.ShouldProcess($manifest.repositoryRoot, 'Write bootstrap only and install the pinned two-file runtime')) {
            $github = Join-Path $manifest.repositoryRoot '.github'
            [void][IO.Directory]::CreateDirectory($github)
            [IO.File]::WriteAllText((Join-Path $manifest.repositoryRoot 'README.md'),
                "# Note Assistant`n`nPrivate, synthetic-note integration test $TestRunId. Application delivery is exclusively issue-driven-delivery.`n")
            [IO.File]::WriteAllText((Join-Path $manifest.repositoryRoot '.gitignore'),
                ".azure-cli/`n.delivery/`n.terraform/`n*.tfstate*`n*.tfplan`n*.tfvars`n.env*`nnode_modules/`n__pycache__/`n")
            [IO.File]::WriteAllText((Join-Path $github 'copilot-instructions.md'), @"
Build only through issue-driven-delivery. Read .github/deployment-target.json and the three parent issues.
Reference existing shared services without adoption, recreation or renumbering. Do not copy other workloads' approvals.
Use containerized agents, not Foundry Hosted Agents. Use managed identity; do not read unrelated secrets.
Keep GSA, SSH trust, TLS verification, enterprise policy, system DNS/proxy/routes and hosts files unchanged.
Use the reviewed existing owned-process Bastion -> strict SSH -> command-VM transport; no parallel unmanaged tunnel.
Publish the private planned/created ownership inventory and pinned owner cleanup procedure before or alongside mutations.
Follow the harness cleanup protocol referenced in deployment-target.json. Keep state/evidence outside disposable paths.
Enforce the durable aggregate ceiling of 1000 real model attempts, including every SDK retry, across all issues and restarts.
No inference connectivity probes; fail closed if the aggregate allowance cannot be verified. Never reset or renew it.
Use https://packagefeedproxy.microsoft.io/npm/ and https://packagefeedproxy.microsoft.io/pypi/simple/
in every dependency-installing container build stage; preserve TLS; do not copy credential-bearing host configuration.
Read applicable owner instructions/index before editing another repository. Refresh this repository index after structural changes.
"@)
            [IO.File]::WriteAllText((Join-Path $github 'repo-index.md'), @"
# Repository index

Bootstrap only: README, instructions, ignore rules, deployment-target.json, delivery-input.json and the pinned two-module workflow.
No application, Dockerfiles, product tests or Terraform implementation exists. Workflow agents own all new implementation.
Delivery source: $($manifest.sourceRevision). Test run: $TestRunId.
"@)
            $target = @{ name = $manifest.deploymentTarget; testRunId = $TestRunId; subscriptionId = $manifest.subscriptionId
                tenantId = $manifest.tenantId; region = 'westus3'; labRoot = $manifest.labRoot
                sharedDependencies = $manifest.sharedDependencies; privateManifestPath = $ManifestPath
                ownershipPath = $manifest.delivery.ownershipPath; modelAttemptLimit = 1000
                cleanupProtocol = (Join-Path $PSScriptRoot 'README.md'); workflowSourceRevision = $manifest.sourceRevision }
            Write-LabJson (Join-Path $github 'deployment-target.json') $target
            [void](Invoke-LabCommand node @((Join-Path $package 'install.mjs'), '--target', $manifest.repositoryRoot))
            $actual = Get-LabRuntimeHashes (Join-Path $github 'extensions\issue-driven-delivery')
            if (($actual | ConvertTo-Json -Compress) -cne ($manifest.runtimeHashes | ConvertTo-Json -Compress)) { throw 'Fresh installation hash mismatch' }
            [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'add', '--', 'README.md', '.gitignore',
                '.github/copilot-instructions.md', '.github/repo-index.md', '.github/deployment-target.json',
                '.github/extensions/issue-driven-delivery/extension.mjs', '.github/extensions/issue-driven-delivery/workflow.mjs'))
            [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'commit', '-m', "Bootstrap pinned Note Assistant test $TestRunId",
                '-m', "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`nCopilot-Session: $($manifest.supervisorSessionId)"))
            $manifest.bootstrapCommit = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'rev-parse', 'HEAD')
            $manifest.stages.bootstrap = $true
            Write-LabJson $ManifestPath $manifest
        }
        @{ stage = $Stage; mode = $Mode; runtimeHashes = $manifest.runtimeHashes } | ConvertTo-Json
        return
    }

    if (-not $manifest.stages.bootstrap) { throw 'Fresh bootstrap required before issue creation' }
    if ($manifest.delivery.started) { throw 'Requirements cannot be generated or rewritten during active delivery' }
    $parents = @(Get-LabParentIssues $TestRunId)
    if ($Mode -eq 'Inspect' -or $WhatIfPreference) {
        @{ stage = $Stage; initialParentCount = 3; orderedParents = $parents } | ConvertTo-Json -Depth 10
        return
    }
    if ($PSCmdlet.ShouldProcess($manifest.repository, 'Create/reuse exactly three immutable ordered parent issues')) {
        $labels = Invoke-LabCommand gh @('label', 'list', '--repo', $manifest.repository, '--limit', '1000', '--json', 'name') |
            ConvertFrom-Json -AsHashtable
        if ('workflow:ready' -cnotin @($labels | ForEach-Object name)) {
            [void](Invoke-LabCommand gh @('label', 'create', 'workflow:ready', '--repo', $manifest.repository,
                '--description', 'Authorized issues ready for sequential delivery'))
        }
        $recorded = @()
        foreach ($parent in $parents) {
            $all = Invoke-LabCommand gh @('issue', 'list', '--repo', $manifest.repository, '--state', 'all',
                '--limit', '10000', '--json', 'number,title,body,url,state,createdAt') | ConvertFrom-Json -AsHashtable
            $current = Resolve-LabParentIssue $parent $all $TestRunId
            if (-not $current) {
                $bodyPath = Join-Path $manifest.evidenceRoot "parent-$($parent.key).txt"
                [IO.File]::WriteAllText($bodyPath, $parent.body)
                $url = Invoke-LabCommand gh @('issue', 'create', '--repo', $manifest.repository, '--title', $parent.title,
                    '--body-file', $bodyPath, '--label', 'workflow:ready')
                $created = Invoke-LabCommand gh @('issue', 'view', $url, '--repo', $manifest.repository,
                    '--json', 'number,title,body,url,state,createdAt') | ConvertFrom-Json -AsHashtable
                $current = Resolve-LabParentIssue $parent @($created) $TestRunId
                if (-not $current) { throw 'Created parent readback has no exact run marker' }
            }
            $recorded += @{ key = $parent.key; number = $current.number; url = $current.url; createdAt = $current.createdAt
                requirementSha256 = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($parent.body))).ToLowerInvariant() }
            $manifest.initialIssues = $recorded
            Write-LabJson $ManifestPath $manifest
        }
        if (@($recorded.number | Select-Object -Unique).Count -ne 3 -or
            $recorded[0].number -ge $recorded[1].number -or $recorded[1].number -ge $recorded[2].number) { throw 'Initial queue order/count mismatch' }
        Write-LabJson (Join-Path $manifest.repositoryRoot '.github\delivery-input.json') @{
            deploymentTarget = $manifest.deploymentTarget; issueNumber = $recorded[0].number
            stackAfter = 0; worktreeRoot = $manifest.worktreeRoot
        }
        $manifest.stages.issues = $true
        [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'add', '--', '.github/delivery-input.json'))
        $pending = Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'diff', '--cached', '--name-only')
        if ($pending) {
            [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'commit', '-m', "Record ordered delivery queue $TestRunId",
                '-m', "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`nCopilot-Session: $($manifest.supervisorSessionId)"))
        }
        Write-LabJson $ManifestPath $manifest
        [void](Invoke-LabCommand git @('-C', $manifest.repositoryRoot, 'push', 'origin', $manifest.defaultBranch))
        @{ stage = $Stage; orderedIssues = $recorded; automaticDelivery = $false } | ConvertTo-Json -Depth 10
    }
} finally {
    if ($lock) { $lock.Dispose() }
    $env:AZURE_CONFIG_DIR = $oldAzure
    $env:AZURE_EXTENSION_USE_DYNAMIC_INSTALL = $oldExtensionInstall
}
