#Requires -Version 7.2
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LabDeliveryTest.psm1') -Force -DisableNameChecking
$script:passed = 0
function Check([string]$Name, [scriptblock]$Body) {
    & $Body
    $script:passed++
    Write-Output "PASS $Name"
}
function Reject([scriptblock]$Body, [string]$Pattern) {
    try { & $Body; throw 'Expected rejection did not occur' }
    catch { if ($_.Exception.Message -notmatch $Pattern) { throw } }
}
function Equal($Actual, $Expected) {
    if (($Actual | ConvertTo-Json -Depth 30 -Compress) -cne ($Expected | ConvertTo-Json -Depth 30 -Compress)) {
        throw "Unexpected value: $($Actual | ConvertTo-Json -Depth 30 -Compress)"
    }
}
function Fixture {
    $base = [IO.Path]::GetPathRoot($PSScriptRoot)
    $root = Join-Path $base 'lab-harness-offline-fixture'
    return @{
        schemaVersion = 1; testRunId = 'offline-123'; repository = 'hoopdad/lab-greeting-agent'; defaultBranch = 'main'
        repositoryRoot = (Join-Path $root 'application'); sourceRoot = (Join-Path $root 'source'); labRoot = (Join-Path $root 'lab')
        worktreeRoot = (Join-Path $root 'worktrees'); evidenceRoot = (Join-Path $root 'evidence')
        sourceRevision = ('a' * 40); subscriptionId = '11111111-1111-1111-1111-111111111111'
        tenantId = '22222222-2222-2222-2222-222222222222'; modelAttemptLimit = 1000
        sharedDependencies = @(@{ role = 'storage'; id = '/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/shared/providers/Microsoft.Storage/storageAccounts/shared' })
        baselineResourceIds = @()
        previous = @{ azureReconciled = $true; processClosureVerified = $true; diagnosticsPreserved = $true
            baselineSha = ('b' * 40); pullRequests = @(); branches = @(); worktrees = @(); issues = @()
            files = @(@{ path = 'README.md'; sha256 = ('c' * 64) }) }
    }
}

Check 'Explicit run identity, private manifest location and persistent worktrees' {
    $m = Fixture
    Assert-LabManifest $m 'offline-123' (Join-Path $m.evidenceRoot 'manifest.json')
    Reject { Assert-LabManifest $m 'another-run' (Join-Path $m.evidenceRoot 'manifest.json') } 'identity'
    Reject { Assert-LabManifest $m 'offline-123' (Join-Path $m.repositoryRoot 'manifest.json') } 'private evidence'
    $m.worktreeRoot = Join-Path $m.repositoryRoot 'trees'
    Reject { Assert-LabManifest $m 'offline-123' (Join-Path $m.evidenceRoot 'manifest.json') } 'outside'
    $m = Fixture
    $m.worktreeRoot = Join-Path ([IO.Path]::GetTempPath()) 'trees'
    Reject { Assert-LabManifest $m 'offline-123' (Join-Path $m.evidenceRoot 'manifest.json') } 'Temporary'
    $m = Fixture
    $m.evidenceRoot = Join-Path $m.worktreeRoot 'private'
    Reject { Assert-LabManifest $m 'offline-123' (Join-Path $m.evidenceRoot 'manifest.json') } 'disjoint'
}
Check 'Reset emits enumerated leaves only, never repository/Git roots' {
    $m = Fixture
    Equal @(Get-LabResetPlan $m).Count 1
    foreach ($unsafe in @('.', '..', '.git', '.git/config', '../other/file', $m.repositoryRoot)) {
        $m.previous.files = @(@{ path = $unsafe; sha256 = ('c' * 64) })
        Reject { Get-LabResetPlan $m } 'Unsafe reset'
    }
}
Check 'Reset fails closed on unknown Azure ownership, missing diagnostics, active process uncertainty and dependent PRs' {
    foreach ($key in @('azureReconciled', 'processClosureVerified', 'diagnosticsPreserved')) {
        $m = Fixture
        $m.previous[$key] = $false
        Reject { Get-LabResetPlan $m } 'reconciled'
    }
    $m = Fixture
    $m.previous.pullRequests = @(@{ number = 4 })
    Reject { Get-LabResetPlan $m } 'dependent PR'
}
Check 'Reset scopes ignored diagnostic leaves and refuses deployment state' {
    $m = Fixture
    $m.previous.files = @(@{ path = '.delivery/workflow.log'; sha256 = ('c' * 64) })
    Equal @(Get-LabResetPlan $m).Count 1
    foreach ($path in @('infra/terraform.tfstate', '.terraform/terraform.tfstate', 'infra/terraform.tfstate.backup')) {
        $m.previous.files[0].path = $path
        Reject { Get-LabResetPlan $m } 'original deployment owner'
    }
}
Check 'Reset never removes the worktree parent/default branch or accepts a moved identity' {
    $m = Fixture
    foreach ($unsafe in @($m.worktreeRoot, $m.repositoryRoot, (Join-Path $m.worktreeRoot '..\other'))) {
        $m.previous.worktrees = @(@{ path = $unsafe; head = ('b' * 40) })
        Reject { Get-LabResetPlan $m } 'outside'
    }
    $m = Fixture
    $m.previous.branches = @(@{ name = 'main'; sha = ('a' * 40); remote = $true })
    Reject { Get-LabResetPlan $m } 'Unsafe branch'
    $m.previous.branches = @(@{ name = 'feature/issue-9'; sha = 'unverified'; remote = $true })
    Reject { Get-LabResetPlan $m } 'Unsafe branch'
}
Check 'Git slash normalization never inventories the primary checkout as disposable' {
    $m = Fixture
    $tree = Join-Path $m.worktreeRoot 'run/issue-1/agent-1'
    $porcelain = "worktree $($m.repositoryRoot -replace '\\', '/')`nHEAD $('a' * 40)`nbranch refs/heads/main`n`n" +
        "worktree $($tree -replace '\\', '/')`nHEAD $('b' * 40)`ndetached`n"
    $actual = @(Get-LabDisposableWorktrees $m.repositoryRoot $porcelain)
    Equal $actual.Count 1
    Equal $actual[0].path ([IO.Path]::GetFullPath($tree))
    Equal $actual[0].head ('b' * 40)
}
Check 'Setup generates exactly three stable ordered immutable parent requirements without implementation' {
    $parents = @(Get-LabParentIssues 'offline-123')
    Equal $parents.Count 3
    Equal @($parents.key) @('A', 'B', 'C')
    Equal $parents @(Get-LabParentIssues 'offline-123')
    if ($parents[0].body -notmatch 'containerized agent' -or $parents[1].body -notmatch 'Architect -> UI/UX Designer -> Web' -or
        $parents[2].body -notmatch 'Invalid requests never invoke the model or write records') { throw 'Required acceptance flow missing' }
    foreach ($parent in $parents) {
        if (-not $parent.body.StartsWith("<!-- lab-delivery-test:offline-123:$($parent.key) -->")) { throw 'Missing stable marker' }
        if ($parent.body -match 'Create a new VNet|Use a Foundry Hosted Agent') { throw 'Old application scope leaked' }
    }
    Check 'Setup reruns reuse exact existing parents and reject duplicates, changed requirements and closed parents' {
        $parent = @(Get-LabParentIssues 'offline-123')[0]
        $existing = @{ number = 91; title = $parent.title; body = $parent.body; state = 'OPEN' }
        Equal (Resolve-LabParentIssue $parent @($existing) 'offline-123').number 91
        Equal (Resolve-LabParentIssue $parent @() 'offline-123') $null
        $emptyCliResult = '[]' | ConvertFrom-Json -AsHashtable
        Equal (Resolve-LabParentIssue $parent $emptyCliResult 'offline-123') $null
        Reject { Resolve-LabParentIssue $parent @($existing, $existing) 'offline-123' } 'Duplicate'
        $existing.body += "`nAdded requirement"
        Reject { Resolve-LabParentIssue $parent @($existing) 'offline-123' } 'requirements/state changed'
        $existing.body = $parent.body
        $existing.state = 'CLOSED'
        Reject { Resolve-LabParentIssue $parent @($existing) 'offline-123' } 'requirements/state changed'
    }
}
Check 'Teardown refuses foreign runs, arbitrary types and all shared roots regardless of name prefix' {
    $m = Fixture
    $prefix = "/subscriptions/$($m.subscriptionId)/resourceGroups/test/providers/"
    foreach ($type in @('Microsoft.Resources/resourceGroups', 'Microsoft.Network/virtualNetworks',
        'Microsoft.CognitiveServices/accounts', 'Microsoft.CognitiveServices/accounts/deployments', 'Microsoft.Storage/storageAccounts',
        'Microsoft.KeyVault/vaults', 'Microsoft.Insights/components', 'Microsoft.OperationalInsights/workspaces',
        'Microsoft.Network/bastionHosts', 'Microsoft.Compute/virtualMachines')) {
        $i = @{ schemaVersion = 1; testRunId = $m.testRunId
            assets = @(@{ kind = 'arm'; id = "$prefix$type/test"; type = $type; ownerRunId = $m.testRunId }) }
        Reject { Get-LabCleanupPlan $m $i } 'Protected'
    }
    $i.assets[0].ownerRunId = 'foreign-run'
    Reject { Get-LabCleanupPlan $m $i } 'Unowned'
    $i.testRunId = 'foreign-run'
    Reject { Get-LabCleanupPlan $m $i } 'identity'
}
Check 'Teardown scopes app resources, namespace data and grants exactly and preserves pre-existing resources' {
    $m = Fixture
    $id = "/subscriptions/$($m.subscriptionId)/resourceGroups/test/providers/Microsoft.App/containerApps/note-web"
    $asset = @{ kind = 'arm'; id = $id; type = 'Microsoft.App/containerApps'; ownerRunId = $m.testRunId }
    $i = @{ schemaVersion = 1; testRunId = $m.testRunId; assets = @($asset) }
    Equal @(Get-LabCleanupPlan $m $i).Count 1
    $m.baselineResourceIds = @($id)
    Reject { Get-LabCleanupPlan $m $i } 'pre-existing'
    $m.baselineResourceIds = @()
    $asset.id = "/subscriptions/$($m.subscriptionId)/resourceGroups/test/providers/Microsoft.Network/virtualNetworks/new-but-protected"
    Reject { Get-LabCleanupPlan $m $i } 'declared resource type'
    $asset.id = $id
    $i.assets = @($asset, $asset)
    Reject { Get-LabCleanupPlan $m $i } 'duplicate'
    $i.assets = @(@{ kind = 'blobNamespace'; id = "$($m.sharedDependencies[0].id)/blobServices/default/containers/$($m.testRunId)"
        parentId = $m.sharedDependencies[0].id
        namespace = 'another-run'; ownerRunId = $m.testRunId })
    Reject { Get-LabCleanupPlan $m $i } 'namespace'
    $i.assets[0].namespace = $m.testRunId
    Equal @(Get-LabCleanupPlan $m $i).Count 1
    $i.assets[0].parentId = '/foreign/storage'
    Reject { Get-LabCleanupPlan $m $i } 'namespace'
}
Check 'No unowned PID kill or unreviewed shared-configuration rollback can enter teardown' {
    $m = Fixture
    $i = @{ schemaVersion = 1; testRunId = $m.testRunId
        assets = @(@{ kind = 'process'; id = '123'; ownerRunId = $m.testRunId }) }
    Reject { Get-LabCleanupPlan $m $i } 'PID is not'
    $i.assets = @(@{ kind = 'sharedConfiguration'; ownerRunId = $m.testRunId
        id = "/subscriptions/$($m.subscriptionId)/resourceGroups/shared/providers/Microsoft.Network/virtualNetworks/shared/subnets/app" })
    Reject { Get-LabCleanupPlan $m $i } 'original owner'
}
Check 'Cleanup is repeatable and unresolved assets/process closure can never be a pass' {
    $plan = @(@{ id = 'one'; kind = 'arm'; action = 'delete' })
    $readback = @{ closure = 'proven closed'; assets = @(@{ id = 'one'; status = 'absent'; evidence = 'exact ARM GET returned 404' }) }
    Assert-LabCleanupReadback $plan $readback
    Assert-LabCleanupReadback $plan $readback
    $readback.closure = 'unknown'
    Reject { Assert-LabCleanupReadback $plan $readback } 'CLOSURE_UNKNOWN'
    $readback.closure = 'proven closed'
    $readback.assets[0].status = 'retained'
    Reject { Assert-LabCleanupReadback $plan $readback } 'unresolved'
    $readback.assets[0].status = 'restored'
    Reject { Assert-LabCleanupReadback $plan $readback } 'required deletion'
}
Check 'PowerShell entry points and shared module parse' {
    foreach ($name in @('Invoke-LabDeliveryTest.ps1', 'Setup-LabDeliveryTest.ps1', 'Teardown-LabDeliveryTest.ps1', 'LabDeliveryTest.psm1')) {
        $tokens = $null
        $errors = $null
        [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $name), [ref]$tokens, [ref]$errors)
        if ($errors.Count) { throw ($errors | Out-String) }
    }
}
Check 'Model deployments inherit only the freshly verified selected account region when child metadata omits location' {
    $m = Fixture
    $account = "/subscriptions/$($m.subscriptionId)/resourceGroups/shared/providers/Microsoft.CognitiveServices/accounts/foundry"
    $m.sharedDependencies = @(
        @{ role = 'foundryAccount'; id = $account; type = 'Microsoft.CognitiveServices/accounts'
            apiVersion = '2025-06-01'; ownerSource = 'owner/source@revision'; intendedUse = 'existing account' },
        @{ role = 'modelDeployment'; id = "$account/deployments/existing"; type = 'Microsoft.CognitiveServices/accounts/deployments'
            apiVersion = '2024-10-01'; ownerSource = 'owner/source@revision'; intendedUse = 'existing model' }
    )
    $result = & (Get-Module LabDeliveryTest) {
        param($manifest)
        function Invoke-LabCommand {
            param($Program, $Arguments)
            $url = $Arguments[$Arguments.IndexOf('--url') + 1]
            $id = ([Uri]$url).AbsolutePath
            $raw = @{ id = $id; type = 'Microsoft.CognitiveServices/accounts'; location = 'westus3'
                properties = @{ provisioningState = 'Succeeded' } }
            if ($id.EndsWith('/deployments/existing')) {
                $raw.type = 'Microsoft.CognitiveServices/accounts/deployments'
                $raw.Remove('location')
            }
            return $raw | ConvertTo-Json -Depth 10
        }
        @(Get-LabSharedBaseline $manifest)
    } $m
    Equal @($result.status) @('ready', 'ready')
}
Check 'Shared-baseline comparison ignores dictionary serialization order but detects actual configuration changes' {
    $before = @(@{ id = 'shared'; configuration = [ordered]@{ tags = @{ owner = 'lab' }; publicNetworkAccess = 'Disabled' } })
    $after = @([ordered]@{ configuration = [ordered]@{ publicNetworkAccess = 'Disabled'; tags = [ordered]@{ owner = 'lab' } }; id = 'shared' })
    Equal (ConvertTo-LabCanonicalJson $before) (ConvertTo-LabCanonicalJson $after)
    $after[0].configuration.publicNetworkAccess = 'Enabled'
    if ((ConvertTo-LabCanonicalJson $before) -ceq (ConvertTo-LabCanonicalJson $after)) { throw 'Shared drift was hidden' }
}
Check 'Repository preparation runs without deployment services while explicit preflight still checks them' {
    $m = Fixture
    $temporary = Join-Path ([IO.Path]::GetTempPath()) "lab-preflight-$([guid]::NewGuid().ToString('N'))"
    $m.evidenceRoot = $temporary
    $m.inventoryPath = Join-Path $temporary 'baseline.json'
    $m.stages = @{ reset = $false; bootstrap = $false; issues = $false }
    $m.delivery = @{ started = $false }
    $m.runtimeHashes = @{}
    $manifestPath = Join-Path $temporary 'manifest.json'
    $setup = Join-Path $PSScriptRoot 'Setup-LabDeliveryTest.ps1'
    $global:labStageFixture = $m
    function global:git {
        $global:LASTEXITCODE = 0
        $arguments = @($args)
        if ($arguments -contains '--show-toplevel') { return $global:labStageFixture.repositoryRoot }
        if ($arguments -contains 'get-url') { return "https://github.com/$($global:labStageFixture.repository).git" }
        if ($arguments -contains 'HEAD') {
            if ($arguments -contains $global:labStageFixture.sourceRoot) { return $global:labStageFixture.sourceRevision }
            return $global:labStageFixture.previous.baselineSha
        }
        if ($arguments -contains '--show-current') { return 'main' }
        if ($arguments -contains 'status' -or $arguments -contains 'ls-files') { return '' }
        throw 'Unexpected offline Git operation'
    }
    function global:gh {
        $global:LASTEXITCODE = 0
        if (($args -join ' ') -notmatch '^repo view ') { throw 'Unexpected offline GitHub operation' }
        return @{ nameWithOwner = $global:labStageFixture.repository; isPrivate = $true
            defaultBranchRef = @{ name = 'main' } } | ConvertTo-Json
    }
    function global:node {
        $global:LASTEXITCODE = 0
        return '{"runs":[],"warnings":[]}'
    }
    function global:az { throw 'Deployment-only prerequisite invoked' }
    function global:docker { throw 'Deployment-only prerequisite invoked' }
    try {
        Write-LabJson $manifestPath $m
        Equal ((& $setup -TestRunId $m.testRunId -ManifestPath $manifestPath -Stage Reset | ConvertFrom-Json).stage) 'Reset'
        $m.stages.reset = $true
        Write-LabJson $manifestPath $m
        Equal ((& $setup -TestRunId $m.testRunId -ManifestPath $manifestPath -Stage Bootstrap | ConvertFrom-Json).stage) 'Bootstrap'
        $m.stages.bootstrap = $true
        Write-LabJson $manifestPath $m
        Equal ((& $setup -TestRunId $m.testRunId -ManifestPath $manifestPath -Stage Issues | ConvertFrom-Json).initialParentCount) 3
        Reject { & $setup -TestRunId $m.testRunId -ManifestPath $manifestPath -Stage Preflight } 'Deployment-only prerequisite invoked'
    } finally {
        foreach ($name in @('git', 'gh', 'node', 'az', 'docker')) { Remove-Item -LiteralPath "Function:\global:$name" }
        Remove-Variable -Name labStageFixture -Scope Global
        if (Test-Path -LiteralPath $manifestPath) { Remove-Item -LiteralPath $manifestPath }
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    }
}
function LifecycleCase {
    param([string]$Failure, [switch]$CleanupFailure)
    $trace = [Collections.Generic.List[string]]::new()
    $receiptPath = Join-Path ([IO.Path]::GetTempPath()) "lab-cycle-$([guid]::NewGuid().ToString('N')).json"
    try {
        $setup = { $trace.Add('setup'); if ($Failure -eq 'setup') { throw 'setup failure' } }.GetNewClosure()
        $execute = { $trace.Add('execute'); if ($Failure -eq 'execution') { throw 'execution failure' } }.GetNewClosure()
        $teardown = { $trace.Add('teardown'); if ($CleanupFailure) { throw 'cleanup failure' } }.GetNewClosure()
        $result = Invoke-LabLifecycle -TestRunId 'offline-123' -Setup $setup -Execute $execute -Teardown $teardown -ReceiptPath $receiptPath
        $saved = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json -AsHashtable
        Equal @($saved.setup, $saved.execution, $saved.teardown, $saved.status) `
            @($result.setup, $result.execution, $result.teardown, $result.status)
        Equal (ConvertTo-LabCanonicalJson $saved.errors) (ConvertTo-LabCanonicalJson $result.errors)
        return @{ result = $result; trace = @($trace) }
    } finally {
        if (Test-Path -LiteralPath $receiptPath) { Remove-Item -LiteralPath $receiptPath }
    }
}
Check 'A successful fresh cycle executes setup, delivery and teardown exactly once' {
    $case = LifecycleCase
    Equal $case.trace @('setup', 'execute', 'teardown')
    Equal $case.result.status 'passed'
    Equal $case.result.errors @()
}
Check 'Setup failure skips execution but still attempts teardown and persists the original failure' {
    $case = LifecycleCase -Failure setup
    Equal $case.trace @('setup', 'teardown')
    Equal $case.result.status 'failed'
    Equal $case.result.execution 'not started'
    Equal $case.result.errors[0].stage 'setup'
    Equal $case.result.teardown 'passed'
}
Check 'Execution failure still tears down and cleanup failure cannot hide the execution failure' {
    $case = LifecycleCase -Failure execution -CleanupFailure
    Equal $case.trace @('setup', 'execute', 'teardown')
    Equal $case.result.status 'failed'
    Equal @($case.result.errors.stage) @('execution', 'teardown')
    Equal $case.result.execution 'failed'
    Equal $case.result.teardown 'failed'
}
Check 'Successful delivery cannot pass a cycle whose teardown failed' {
    $case = LifecycleCase -CleanupFailure
    Equal $case.trace @('setup', 'execute', 'teardown')
    Equal $case.result.status 'failed'
    Equal $case.result.execution 'passed'
    Equal $case.result.errors[0].stage 'teardown'
}
Check 'The lifecycle entry point starts once, records a failed command and still invokes teardown' {
    $temporary = Join-Path ([IO.Path]::GetTempPath()) "lab-cycle-entry-$([guid]::NewGuid().ToString('N'))"
    [void][IO.Directory]::CreateDirectory($temporary)
    $m = Fixture
    $m.repositoryRoot = Join-Path $temporary 'application'
    $m.evidenceRoot = Join-Path $temporary 'evidence'
    [void][IO.Directory]::CreateDirectory($m.repositoryRoot)
    $configuration = Join-Path $m.evidenceRoot 'configuration.json'
    $manifestPath = Join-Path $m.evidenceRoot 'manifest.json'
    $global:labCycleFixture = $m
    $global:labCycleTrace = [Collections.Generic.List[string]]::new()
    function global:az {
        $global:LASTEXITCODE = 0
        @{ subscription = $global:labCycleFixture.subscriptionId; tenant = $global:labCycleFixture.tenantId
            state = 'Enabled' } | ConvertTo-Json
    }
    function global:node {
        $global:LASTEXITCODE = 0
        '{"runs":[{"sessionId":"owning-session","runId":"new-run","status":"error"}],"warnings":[]}'
    }
    function global:copilot {
        $global:labCycleTrace.Add('execute')
        $global:LASTEXITCODE = 7
        'Expected offline execution failure'
    }
    try {
        foreach ($name in @('Invoke-LabDeliveryTest.ps1', 'LabDeliveryTest.psm1')) {
            Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $temporary $name)
        }
        [IO.File]::WriteAllText((Join-Path $temporary 'Setup-LabDeliveryTest.ps1'), @'
param($TestRunId, $ManifestPath, $ConfigurationPath, $Stage, $Mode)
$global:labCycleTrace.Add($Stage)
if ($Stage -eq 'Inventory') {
    $m = $global:labCycleFixture
    $m.inventoryPath = Join-Path $m.evidenceRoot 'baseline.json'
    $m.delivery = @{ started = $false; stopped = $true; ownershipPath = (Join-Path $m.evidenceRoot 'ownership.json') }
    Write-LabJson $m.inventoryPath @{ runs = @{ runs = @() } }
    Write-LabJson $ManifestPath $m
}
@{ stage = $Stage } | ConvertTo-Json
'@)
        [IO.File]::WriteAllText((Join-Path $temporary 'Teardown-LabDeliveryTest.ps1'), @'
param($TestRunId, $ManifestPath, $Mode)
$global:labCycleTrace.Add('teardown')
@{ status = 'verified offline stub' } | ConvertTo-Json
'@)
        Write-LabJson $configuration $m
        $runner = Join-Path $temporary 'Invoke-LabDeliveryTest.ps1'
        Reject { & $runner -TestRunId $m.testRunId -ManifestPath $manifestPath `
            -ConfigurationPath $configuration -Mode Apply } 'Test cycle failed'
        Equal @($global:labCycleTrace) @('Inventory', 'Reset', 'Bootstrap', 'Issues', 'execute', 'teardown')
        $saved = Read-LabManifest $m.testRunId $manifestPath
        Equal $saved.delivery.exitCode 7
        Equal $saved.delivery.runId 'new-run'
        Equal $saved.delivery.stopped $true
        $receipt = Get-Content -LiteralPath (Join-Path $m.evidenceRoot 'lifecycle-receipt.json') -Raw | ConvertFrom-Json
        Equal $receipt.execution 'failed'
        Equal $receipt.teardown 'passed'
        Reject { & $runner -TestRunId $m.testRunId -ManifestPath $manifestPath -Mode Apply } 'not a fresh test'
        Equal @($global:labCycleTrace).Count 6
    } finally {
        foreach ($name in @('az', 'node', 'copilot')) { Remove-Item -LiteralPath "Function:\global:$name" }
        Remove-Variable -Name labCycleFixture, labCycleTrace -Scope Global
        Import-Module (Join-Path $PSScriptRoot 'LabDeliveryTest.psm1') -Force -DisableNameChecking
        Remove-Item -LiteralPath $temporary -Recurse -Force
    }
}
Write-Output "$script:passed offline harness checks passed; no external commands or mutations executed."
