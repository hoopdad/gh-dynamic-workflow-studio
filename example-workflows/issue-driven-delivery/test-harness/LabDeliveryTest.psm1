#Requires -Version 7.2
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-LabCommand {
    param([string]$Program, [string[]]$Arguments)
    $output = @(& $Program @Arguments 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). No mutation will be retried automatically." }
    return ($output -join "`n").Trim()
}

function Test-LabDescendant {
    param([string]$Parent, [string]$Child)
    $relative = [IO.Path]::GetRelativePath([IO.Path]::GetFullPath($Parent), [IO.Path]::GetFullPath($Child))
    return $relative -ne '.' -and -not [IO.Path]::IsPathRooted($relative) -and
        $relative -ne '..' -and -not $relative.StartsWith("..$([IO.Path]::DirectorySeparatorChar)")
}

function Assert-LabUnlinkedPath {
    param([string]$Path)
    for ($current = [IO.Path]::GetFullPath($Path); $current; $current = [IO.Path]::GetDirectoryName($current)) {
        if (Test-Path -LiteralPath $current) {
            if ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Linked path refused: $current"
            }
        }
    }
}

function Assert-LabManifest {
    param([Collections.IDictionary]$Manifest, [string]$TestRunId, [string]$ManifestPath)
    if ($TestRunId -cnotmatch '^[a-z0-9][a-z0-9-]{5,63}$' -or
        $Manifest.schemaVersion -ne 1 -or $Manifest.testRunId -cne $TestRunId) { throw 'Test-run identity mismatch' }
    foreach ($key in @('repositoryRoot', 'sourceRoot', 'labRoot', 'worktreeRoot', 'evidenceRoot')) {
        if (-not [IO.Path]::IsPathFullyQualified($Manifest[$key])) { throw "Absolute $key required" }
        Assert-LabUnlinkedPath $Manifest[$key]
    }
    if ($Manifest.repository -cne 'hoopdad/lab-greeting-agent' -or
        $Manifest.sourceRevision -cnotmatch '^[a-f0-9]{40}$' -or
        $Manifest.subscriptionId -cnotmatch '^[a-f0-9-]{36}$' -or
        $Manifest.tenantId -cnotmatch '^[a-f0-9-]{36}$') { throw 'Explicit repository, source revision and Azure scope required' }
    foreach ($root in @($Manifest.repositoryRoot, $Manifest.sourceRoot, $Manifest.labRoot)) {
        if ($Manifest.evidenceRoot -eq $root -or (Test-LabDescendant $root $Manifest.evidenceRoot) -or
            $Manifest.worktreeRoot -eq $root -or (Test-LabDescendant $root $Manifest.worktreeRoot)) {
            throw 'Evidence and worktrees must be outside all owning checkouts'
        }
    }
    if ($Manifest.evidenceRoot -eq $Manifest.worktreeRoot -or
        (Test-LabDescendant $Manifest.worktreeRoot $Manifest.evidenceRoot) -or
        (Test-LabDescendant $Manifest.evidenceRoot $Manifest.worktreeRoot)) { throw 'Evidence and disposable worktrees must be disjoint' }
    if ($Manifest.worktreeRoot -eq [IO.Path]::GetTempPath().TrimEnd('\', '/') -or
        (Test-LabDescendant ([IO.Path]::GetTempPath()) $Manifest.worktreeRoot)) { throw 'Temporary worktree root refused' }
    if (-not (Test-LabDescendant $Manifest.evidenceRoot $ManifestPath)) { throw 'Manifest must be in the private evidence directory' }
    Assert-LabUnlinkedPath $ManifestPath
    if ($Manifest.modelAttemptLimit -ne 1000) { throw 'The aggregate model-attempt ceiling must remain 1000' }
}

function Read-LabManifest {
    param([string]$TestRunId, [string]$ManifestPath)
    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json -AsHashtable
    Assert-LabManifest $manifest $TestRunId $ManifestPath
    return $manifest
}

function Write-LabJson {
    param([string]$Path, $Value)
    Assert-LabUnlinkedPath $Path
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path))
    $temporary = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 50), [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($temporary, $Path, $true)
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    }
}

function Invoke-LabLifecycle {
    param(
        [string]$TestRunId,
        [scriptblock]$Setup,
        [scriptblock]$Execute,
        [scriptblock]$Teardown,
        [string]$ReceiptPath
    )
    $receipt = @{
        schemaVersion = 1; testRunId = $TestRunId
        startedAt = [DateTime]::UtcNow.ToString('o')
        setup = 'not started'; execution = 'not started'; teardown = 'not started'
        status = 'failed'; errors = @()
    }
    $stage = 'setup'
    try {
        $receipt.setup = 'running'
        & $Setup | Out-Null
        $receipt.setup = 'passed'
        $stage = 'execution'
        $receipt.execution = 'running'
        & $Execute | Out-Null
        $receipt.execution = 'passed'
    } catch {
        $receipt[$stage] = 'failed'
        $receipt.errors += @{ stage = $stage; message = $_.Exception.Message }
    } finally {
        $receipt.teardown = 'running'
        try {
            & $Teardown | Out-Null
            $receipt.teardown = 'passed'
        } catch {
            $receipt.teardown = 'failed'
            $receipt.errors += @{ stage = 'teardown'; message = $_.Exception.Message }
        }
        if ($receipt.setup -ceq 'passed' -and $receipt.execution -ceq 'passed' -and $receipt.teardown -ceq 'passed') {
            $receipt.status = 'passed'
        }
        $receipt.completedAt = [DateTime]::UtcNow.ToString('o')
        Write-LabJson $ReceiptPath $receipt
    }
    return $receipt
}

function ConvertTo-LabCanonicalValue {
    param($Value)
    if ($Value -is [Collections.IDictionary]) {
        $result = [ordered]@{}
        foreach ($key in @($Value.Keys | Sort-Object -CaseSensitive)) { $result[$key] = ConvertTo-LabCanonicalValue $Value[$key] }
        return $result
    }
    if ($Value -is [Collections.IEnumerable] -and $Value -isnot [string]) {
        return ,@($Value | ForEach-Object { ,(ConvertTo-LabCanonicalValue $_) })
    }
    return $Value
}

function ConvertTo-LabCanonicalJson {
    param($Value)
    return ConvertTo-Json -InputObject (ConvertTo-LabCanonicalValue $Value) -Depth 50 -Compress
}

function Assert-LabRepository {
    param([Collections.IDictionary]$Manifest)
    $root = $Manifest.repositoryRoot
    $actual = Invoke-LabCommand git @('-C', $root, 'rev-parse', '--show-toplevel')
    if ([IO.Path]::GetFullPath($actual) -ine [IO.Path]::GetFullPath($root)) { throw 'Target must be the exact Git root' }
    $remote = Invoke-LabCommand git @('-C', $root, 'remote', 'get-url', 'origin')
    if ($remote -cnotin @("https://github.com/$($Manifest.repository).git", "git@github.com:$($Manifest.repository).git")) {
        throw 'Remote identity mismatch'
    }
    $repository = Invoke-LabCommand gh @('repo', 'view', $Manifest.repository, '--json', 'nameWithOwner,isPrivate,defaultBranchRef') |
        ConvertFrom-Json -AsHashtable
    if (-not $repository.isPrivate -or $repository.nameWithOwner -cne $Manifest.repository -or
        $repository.defaultBranchRef.name -cne $Manifest.defaultBranch) { throw 'Private repository/default branch changed' }
}

function Set-LabAzureScope {
    param([Collections.IDictionary]$Manifest)
    $env:AZURE_CONFIG_DIR = Join-Path $Manifest.labRoot '.azure-cli'
    $env:AZURE_EXTENSION_USE_DYNAMIC_INSTALL = 'no'
    $scope = Invoke-LabCommand az @('account', 'show', '--subscription', $Manifest.subscriptionId,
        '--query', '{subscription:id,tenant:tenantId,state:state}', '-o', 'json', '--only-show-errors') |
        ConvertFrom-Json -AsHashtable
    if ($scope.subscription -cne $Manifest.subscriptionId -or $scope.tenant -cne $Manifest.tenantId -or
        $scope.state -cne 'Enabled') { throw 'Isolated Azure scope mismatch; use the owning Connect-LabAzure procedure' }
}

function Get-LabRuntimeHashes {
    param([string]$Directory)
    $hashes = [ordered]@{}
    foreach ($name in @('extension.mjs', 'workflow.mjs')) {
        $hashes[$name] = (Get-FileHash -LiteralPath (Join-Path $Directory $name) -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    return $hashes
}

function Get-LabDisposableWorktrees {
    param([string]$RepositoryRoot, [string]$Porcelain)
    foreach ($block in ($Porcelain -split '\r?\n\r?\n')) {
        if ($block -notmatch '(?m)^worktree (.+)\r?$') { continue }
        $treePath = [IO.Path]::GetFullPath($Matches[1].Trim())
        if ($treePath -ieq [IO.Path]::GetFullPath($RepositoryRoot)) { continue }
        if ($block -notmatch '(?m)^HEAD ([a-f0-9]{40})') { throw 'Worktree HEAD missing' }
        @{ path = $treePath; head = $Matches[1] }
    }
}

function Assert-LabPinnedSource {
    param([Collections.IDictionary]$Manifest)
    $head = Invoke-LabCommand git @('-C', $Manifest.sourceRoot, 'rev-parse', 'HEAD')
    if ($head -cne $Manifest.sourceRevision) { throw 'Source checkout is not at the pinned revision' }
    $package = Join-Path $Manifest.sourceRoot 'example-workflows\issue-driven-delivery'
    $dirty = Invoke-LabCommand git @('-C', $Manifest.sourceRoot, 'status', '--porcelain', '--',
        'example-workflows/issue-driven-delivery/extension.mjs', 'example-workflows/issue-driven-delivery/workflow.mjs',
        'example-workflows/issue-driven-delivery/install.mjs')
    if ($dirty) { throw 'Pinned source runtime/installer has uncommitted changes' }
    return $package
}

function Get-LabSharedBaseline {
    param([Collections.IDictionary]$Manifest)
    $result = @()
    foreach ($dependency in $Manifest.sharedDependencies) {
        if (-not $dependency.id) {
            $result += @{ role = $dependency.role; status = 'blocked'; reason = 'No existing owner-verified resource selected' }
            continue
        }
        if (-not $dependency.id.StartsWith("/subscriptions/$($Manifest.subscriptionId)/", [StringComparison]::OrdinalIgnoreCase) -or
            -not $dependency.apiVersion -or -not $dependency.ownerSource) { throw 'Dependency scope/owner evidence missing' }
        $raw = Invoke-LabCommand az @('rest', '--method', 'get', '--url',
            "https://management.azure.com$($dependency.id)?api-version=$($dependency.apiVersion)",
            '--subscription', $Manifest.subscriptionId, '-o', 'json', '--only-show-errors') | ConvertFrom-Json -AsHashtable
        if ($raw.id -ine $dependency.id -or $raw.type -ine $dependency.type) { throw 'Shared dependency identity/type mismatch' }
        $location = $raw['location']
        if (-not $location -and $raw.type -ieq 'Microsoft.CognitiveServices/accounts/deployments') {
            $parentId = $raw.id -replace '/deployments/[^/]+$', ''
            $parents = @($Manifest.sharedDependencies | Where-Object { $_.role -ceq 'foundryAccount' -and $_.id -ieq $parentId })
            if ($parents.Count -ne 1) { throw 'Model deployment must belong to the selected existing Foundry account' }
            $parent = Invoke-LabCommand az @('rest', '--method', 'get', '--url',
                "https://management.azure.com$parentId`?api-version=$($parents[0].apiVersion)",
                '--subscription', $Manifest.subscriptionId, '-o', 'json', '--only-show-errors') | ConvertFrom-Json -AsHashtable
            if ($parent.id -ine $parentId -or $parent.type -ine 'Microsoft.CognitiveServices/accounts') { throw 'Model parent identity mismatch' }
            $location = $parent.location
        }
        # Deliberately omit keys, connection strings, instrumentation keys and arbitrary resource bodies.
        $configuration = [ordered]@{
            id = $raw.id; type = $raw.type; location = $location
            tags = $raw['tags']; identity = $raw['identity']
            publicNetworkAccess = $raw.properties['publicNetworkAccess']
            networkAcls = $raw.properties['networkAcls']
            disableLocalAuth = $raw.properties['disableLocalAuth']
            allowSharedKeyAccess = $raw.properties['allowSharedKeyAccess']
            minimumTlsVersion = $raw.properties['minimumTlsVersion']
            provisioningState = $raw.properties['provisioningState']
            sku = $raw['sku']; model = $raw.properties['model']
            endpoints = $raw.properties['endpoints']; primaryEndpoints = $raw.properties['primaryEndpoints']
        }
        if ($raw.type -ieq 'Microsoft.Network/virtualNetworks') {
            $configuration.addressSpace = $raw.properties.addressSpace
            $configuration.subnets = @($raw.properties.subnets | ForEach-Object {
                @{ id = $_.id; addressPrefix = $_.properties.addressPrefix; addressPrefixes = $_.properties.addressPrefixes
                    delegations = $_.properties.delegations; networkSecurityGroup = $_.properties.networkSecurityGroup
                    routeTable = $_.properties.routeTable; privateEndpointNetworkPolicies = $_.properties.privateEndpointNetworkPolicies }
            })
            $configuration.peerings = $raw.properties.virtualNetworkPeerings
        }
        $result += @{ role = $dependency.role; status = $(if ($location -eq 'westus3' -and
                    $raw.properties['provisioningState'] -eq 'Succeeded') { 'ready' } else { 'blocked' })
            intendedUse = $dependency.intendedUse; ownerSource = $dependency.ownerSource; configuration = $configuration }
    }
    return $result
}

function Assert-LabPrerequisites {
    param([Collections.IDictionary]$Manifest)
    Set-LabAzureScope $Manifest
    foreach ($role in @('foundryAccount', 'foundryProject', 'modelDeployment', 'vnet', 'appInsights', 'logAnalytics', 'keyVault', 'storage')) {
        $selected = @($Manifest.sharedDependencies | Where-Object { $_.role -ceq $role -and $_.id })
        if ($selected.Count -ne 1) { throw "Required existing West US 3 shared dependency unresolved: $role" }
    }
    $shared = @(Get-LabSharedBaseline $Manifest)
    if (@($shared | Where-Object status -ne 'ready').Count) { throw 'Existing shared dependency is not in West US 3' }
    $server = Invoke-LabCommand docker @('version', '--format', '{{json .Server}}') | ConvertFrom-Json -AsHashtable
    if ($server.Os -cne 'linux') { throw 'A real Linux Docker daemon is required' }
    return $shared
}

function Assert-LabQuiescent {
    param([Collections.IDictionary]$Manifest, [switch]$CurrentRunOnly)
    $observer = Join-Path $PSScriptRoot 'observe-runs.mjs'
    $observed = Invoke-LabCommand node @($observer, $Manifest.sourceRoot, $Manifest.repositoryRoot) |
        ConvertFrom-Json -AsHashtable
    if ($observed.warnings.Count -or @($observed.runs | Where-Object { $_.status -notin @('completed', 'error', 'halted', 'cancelled') }).Count) {
        throw 'Active or unobservable workflow; stop through its owning Copilot session before cleanup'
    }
    if (-not $CurrentRunOnly -and -not $Manifest.previous.processClosureVerified) {
        throw 'Old owned process/listener closure has not been independently recorded'
    }
    return $observed
}

function Get-LabResetPlan {
    param([Collections.IDictionary]$Manifest)
    if (-not $Manifest.previous.azureReconciled -or -not $Manifest.previous.processClosureVerified -or
        -not $Manifest.previous.diagnosticsPreserved) { throw 'Old Azure ownership, process closure and diagnostics must be reconciled before reset' }
    if (-not $Manifest.previous.baselineSha -or @($Manifest.previous.pullRequests).Count) {
        throw 'Baseline missing or dependent PR/stack disposition required'
    }
    $plan = @()
    foreach ($file in $Manifest.previous.files) {
        if ([IO.Path]::IsPathRooted($file.path) -or $file.path -match '(^|[\\/])(\.\.?|\.git)([\\/]|$)' -or
            -not (Test-LabDescendant $Manifest.repositoryRoot (Join-Path $Manifest.repositoryRoot $file.path)) -or
            $file.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw "Unsafe reset file: $($file.path)" }
        Assert-LabUnlinkedPath (Join-Path $Manifest.repositoryRoot $file.path)
        if ($file.path -match '\.tfstate(\.backup)?$') {
            throw 'State-bearing reset candidate must be reconciled by its original deployment owner'
        }
        $plan += @{ kind = 'file'; path = $file.path; sha256 = $file.sha256 }
    }
    foreach ($tree in $Manifest.previous.worktrees) {
        if (-not (Test-LabDescendant $Manifest.worktreeRoot $tree.path) -or $tree.head -cnotmatch '^[a-f0-9]{40}$') {
            throw 'Worktree is outside this test inventory'
        }
        Assert-LabUnlinkedPath $tree.path
        $plan += @{ kind = 'worktree'; path = $tree.path; head = $tree.head }
    }
    foreach ($branch in $Manifest.previous.branches) {
        if ($branch.name -ceq $Manifest.defaultBranch -or $branch.name -cnotmatch '^(feature/issue-[1-9][0-9]*|delivery-[a-z0-9-]+|bootstrap/[a-z0-9-]+|fix/[a-z0-9-]+)$' -or
            $branch.sha -cnotmatch '^[a-f0-9]{40}$') { throw 'Unsafe branch inventory' }
        $plan += @{ kind = 'branch'; name = $branch.name; sha = $branch.sha; remote = $branch.remote }
    }
    foreach ($issue in $Manifest.previous.issues) {
        if ($issue.number -isnot [long] -and $issue.number -isnot [int]) { throw 'Invalid old issue number' }
        if ($issue.number -lt 1 -or -not $issue.nodeId) { throw 'Exact old issue identity required' }
        $plan += @{ kind = 'issue'; number = $issue.number; nodeId = $issue.nodeId }
    }
    return $plan
}

function Get-LabParentIssues {
    param([string]$TestRunId)
    $common = @"

Use synthetic, non-sensitive notes only. Reuse the owner-verified shared West US 3 dependencies in
.github/deployment-target.json; reference them without import/adoption, recreation or renumbering.
Use a containerized agent calling an existing suitable Foundry deployment, not a Foundry Hosted Agent.
Keep all backend components private; browser requests use the web-owned same-origin API proxy.
"@
    return @(
        @{ key = 'A'; title = 'Private walking skeleton'; body = @"
Build a minimal Note Assistant: browser -> web-owned same-origin API proxy -> API -> containerized
agent -> existing Foundry model -> existing Blob Storage.

Acceptance criteria:
- Implement Terraform and runnable deploy/rollback commands using shared resources and the smallest needed app-specific additions.
- Deploy private web, API and containerized agent components.
- A user submits a short note in the browser, receives a concise real-model summary, and the original note/result are stored under the run-specific Blob namespace with a stable record ID.
- Deployed acceptance exercises the real model and real storage, not mocks.
- Use existing Application Insights/Log Analytics for correlated operational evidence.
- Distinguish process health from dependency readiness. Include deterministic local tests, deployment smoke tests and a private connectivity launcher using the reviewed owned-process transport.
- Publish exact planned/created ownership and cleanup outputs to the private harness inventory before or alongside every mutation, including partial deployment. Follow the harness cleanup protocol.
- Durably reserve every real model attempt before invocation across all issues, smoke/E2E, repairs, SDK retries and restarts, under the aggregate ceiling of 1000. Disable hidden retries or reserve each retry. Fail closed if usage cannot be bounded; do not reset/renew the allowance. Connectivity probes never invoke the model.
$common
"@ },
        @{ key = 'B'; title = 'Designed note history'; body = @"
Extend the private walking skeleton without replacing its infrastructure.

Acceptance criteria:
- Exercise Architect -> UI/UX Designer -> Web. Publish the designer-owned artifact before implementation; Web treats it as authoritative within issue scope, architecture contracts and repository policy.
- Provide note submission and loading, success, error and empty states, a saved-note list and record detail.
- Saved records survive page reload and are read from real storage.
- Keep browser/API calls same-origin and backend components private.
- Add local and deployed tests for these flows and the design handoff; preserve earlier walking-skeleton flows and the same durable aggregate model allowance.
$common
"@ },
        @{ key = 'C'; title = 'Download, validation and operational traceability'; body = @"
Extend designed note history.

Acceptance criteria:
- Download a selected saved note and result as JSON.
- Reject blank/whitespace-only notes and notes longer than 4000 Unicode code points. Client displays an actionable validation error and sends no request; API independently returns HTTP 422 with a stable validation error code. Invalid requests never invoke the model or write records.
- Propagate a correlation ID through web/API/agent/model-call metadata/storage and telemetry without logging raw prompts, responses or credentials.
- Add deterministic local tests and deployed E2E for download, validation, retained history and correlation.
- Verify earlier walking-skeleton/history flows still work, using the same infrastructure, storage namespace and durable aggregate model allowance.
$common
"@ }
    ) | ForEach-Object {
        $_.body = "<!-- lab-delivery-test:$TestRunId`:$($_.key) -->`n$($_.body.Trim())"
        $_
    }
}

function Resolve-LabParentIssue {
    param([Collections.IDictionary]$Parent, $Issues, [string]$TestRunId)
    $marker = "<!-- lab-delivery-test:$TestRunId`:$($Parent.key) -->"
    $existing = @($Issues | Where-Object { $null -ne $_ -and $_.body.Contains($marker) })
    if ($existing.Count -gt 1) { throw 'Duplicate run marker; do not create or silently rewrite issues' }
    if (-not $existing.Count) { return $null }
    $current = $existing[0]
    if ($current.title -cne $Parent.title -or $current.body.Replace("`r`n", "`n") -cne $Parent.body.Replace("`r`n", "`n") -or
        $current.state -cne 'OPEN') { throw 'Existing parent requirements/state changed; human reconciliation required' }
    return $current
}

function Get-LabCleanupPlan {
    param([Collections.IDictionary]$Manifest, [Collections.IDictionary]$Inventory)
    if ($Inventory.schemaVersion -ne 1 -or $Inventory.testRunId -cne $Manifest.testRunId) { throw 'Cleanup inventory identity mismatch' }
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $shared = @($Manifest.sharedDependencies | Where-Object id | ForEach-Object id)
    $preexisting = @($Manifest['baselineResourceIds'])
    $plan = @()
    foreach ($asset in $Inventory.assets) {
        if ($asset.ownerRunId -cne $Manifest.testRunId -or -not $asset.id -or -not $seen.Add($asset.id) -or
            $asset.kind -cnotin @('arm', 'blobNamespace', 'image', 'grant', 'sharedConfiguration', 'process')) { throw 'Unowned, duplicate or unknown cleanup asset' }
        if ($asset.kind -in @('arm', 'grant', 'sharedConfiguration')) {
            if (-not $asset.id.StartsWith("/subscriptions/$($Manifest.subscriptionId)/", [StringComparison]::OrdinalIgnoreCase) -or
                $asset.id -in $shared -or ($asset.kind -ne 'sharedConfiguration' -and $asset.id -in $preexisting)) {
                throw 'Foreign/shared/pre-existing resource deletion refused'
            }
            if ($asset.kind -eq 'arm' -and $asset.type -cnotin @(
                'Microsoft.App/containerApps', 'Microsoft.App/managedEnvironments',
                'Microsoft.ContainerRegistry/registries', 'Microsoft.ManagedIdentity/userAssignedIdentities',
                'Microsoft.Network/privateEndpoints', 'Microsoft.Network/networkInterfaces',
                'Microsoft.Network/networkSecurityGroups')) { throw 'Protected or unsupported resource type' }
            if ($asset.kind -eq 'arm' -and $asset.id -inotmatch (
                '/providers/' + [regex]::Escape($asset.type) + '/[^/]+$')) { throw 'ARM ID does not match the declared resource type' }
            if ($asset.kind -eq 'grant' -and $asset.id -notmatch '/providers/Microsoft.Authorization/roleAssignments/[a-f0-9-]+$') {
                throw 'Exact temporary grant ID required'
            }
            if ($asset.kind -eq 'sharedConfiguration' -and
                    (-not $asset['ownerProcedure'] -or -not $asset['baselineHash'] -or $asset['ownerRoot'] -ine $Manifest.labRoot)) {
                throw 'Shared configuration requires its original owner procedure and baseline'
            }
        }
        if ($asset.kind -in @('blobNamespace', 'image') -and
            ($asset.namespace -cne $Manifest.testRunId -or -not $asset.parentId -or $asset.parentId -notin $shared)) {
            throw 'Exact run namespace on an inventoried shared service required'
        }
        if ($asset.kind -eq 'blobNamespace' -and
            ($asset.parentId -notmatch '/providers/Microsoft.Storage/storageAccounts/[^/]+$' -or
                $asset.id -cne "$($asset.parentId)/blobServices/default/containers/$($Manifest.testRunId)")) {
            throw 'Exact run-specific container ID required; broad prefix deletion is refused'
        }
        if ($asset.kind -eq 'image' -and
            ($asset.parentId -notmatch '/providers/Microsoft.ContainerRegistry/registries/[^/]+$' -or
                $asset.id -cnotmatch ('^' + [regex]::Escape("$($asset.parentId)/repositories/$($Manifest.testRunId)/") +
                '[a-z0-9._/-]+/manifests/sha256:[a-f0-9]{64}$'))) { throw 'Exact namespaced image digest required' }
        if ($asset.kind -eq 'process' -and
            (-not $asset['ownerHandle'] -or -not $asset['creationTime'] -or -not $asset['closureProcedure'])) {
            throw 'A PID is not process ownership; retained owner handle and creation identity required'
        }
        $plan += @{ id = $asset.id; kind = $asset.kind; action = $(if ($asset.kind -eq 'sharedConfiguration') { 'restore' } else { 'delete' }) }
    }
    return $plan
}

function Assert-LabCleanupReadback {
    param($Plan, $Readback)
    $expected = @($Plan | ForEach-Object id | Sort-Object)
    $actual = @($Readback.assets | ForEach-Object id | Sort-Object)
    if (($expected -join "`n") -cne ($actual -join "`n") -or $Readback.closure -cne 'proven closed' -or
        @($Readback.assets | Where-Object { $_.status -cnotin @('absent', 'restored') -or -not $_.evidence }).Count) {
        throw 'CLOSURE_UNKNOWN or unresolved assets; cleanup is not a pass'
    }
    foreach ($item in $Plan) {
        $status = @($Readback.assets | Where-Object id -CEQ $item.id)[0].status
        $required = $(if ($item.action -ceq 'restore') { 'restored' } else { 'absent' })
        if ($status -cne $required) { throw 'Cleanup readback does not prove the required deletion/restoration' }
    }
}

Export-ModuleMember -Function *
