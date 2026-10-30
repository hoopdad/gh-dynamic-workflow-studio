#Requires -Version 7.2
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$TestRunId,
    [Parameter(Mandatory)][string]$ManifestPath,
    [ValidateSet('Inspect', 'Apply')][string]$Mode = 'Inspect'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LabDeliveryTest.psm1') -DisableNameChecking
$manifest = Read-LabManifest $TestRunId $ManifestPath
$lock = $null
$oldAzure = $env:AZURE_CONFIG_DIR
$oldExtensionInstall = $env:AZURE_EXTENSION_USE_DYNAMIC_INSTALL
$receipt = @{ testRunId = $TestRunId; mode = $Mode; status = 'blocked'; closure = 'CLOSURE_UNKNOWN'
    assets = @(); retained = @(); plan = @(); sharedComparison = 'unknown'; repositoryPreserved = $true }
try {
    if ($Mode -eq 'Apply' -and -not $WhatIfPreference) {
        $lock = [IO.File]::Open("$ManifestPath.lock", 'OpenOrCreate', 'ReadWrite', 'None')
    }
    Assert-LabRepository $manifest
    [void](Assert-LabQuiescent $manifest -CurrentRunOnly)
    if (-not $manifest.delivery.stopped) { throw 'Stop delivery through its owning runtime before teardown' }
    Set-LabAzureScope $manifest
    $baseline = Get-Content -LiteralPath $manifest.inventoryPath -Raw | ConvertFrom-Json -AsHashtable
    $inventoryPath = $manifest.delivery.ownershipPath
    if (-not (Test-LabDescendant $manifest.evidenceRoot $inventoryPath)) { throw 'Ownership inventory must survive outside disposable paths' }
    if (-not (Test-Path -LiteralPath $inventoryPath)) {
        if ($manifest.delivery.started) { throw 'Missing mutation inventory; unknown ownership is a blocker' }
        $inventory = @{ schemaVersion = 1; testRunId = $TestRunId; assets = @() }
    } else {
        Assert-LabUnlinkedPath $inventoryPath
        $inventory = Get-Content -LiteralPath $inventoryPath -Raw | ConvertFrom-Json -AsHashtable
    }
    $plan = @(Get-LabCleanupPlan $manifest $inventory)
    $receipt.plan = $plan
    if ($plan.Count) {
        $cleanup = $inventory.cleanup
        if (-not $cleanup -or -not (Test-LabDescendant $manifest.evidenceRoot $cleanup.path) -or
            $cleanup.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $cleanup.sourceRevision -cnotmatch '^[a-f0-9]{40}$') {
            throw 'Delivery must publish a pinned, independently reviewed owner cleanup procedure before mutation'
        }
        Assert-LabUnlinkedPath $cleanup.path
        if ((Get-FileHash -LiteralPath $cleanup.path).Hash.ToLowerInvariant() -cne $cleanup.sha256) { throw 'Cleanup procedure changed' }
        $common = @('-NoProfile', '-File', $cleanup.path, '-TestRunId', $TestRunId,
            '-ManifestPath', $ManifestPath, '-InventoryPath', $inventoryPath)
        $preview = Invoke-LabCommand pwsh ($common + @('-Mode', 'Inspect')) | ConvertFrom-Json -AsHashtable
        $expected = $plan | Sort-Object id | ConvertTo-Json -Depth 10 -Compress
        $actual = $preview.plan | Sort-Object id | ConvertTo-Json -Depth 10 -Compress
        if ($actual -cne $expected) { throw 'Owner cleanup plan does not match exact authorized inventory' }
        if ($Mode -eq 'Apply' -and $PSCmdlet.ShouldProcess($TestRunId, 'Execute pinned exact-owner teardown; preserve shared resources, repository, issues and PR stack')) {
            # The owner procedure keeps Terraform state and applies only its verified saved destroy plan.
            $applied = Invoke-LabCommand pwsh ($common + @('-Mode', 'Apply')) | ConvertFrom-Json -AsHashtable
            $receipt.assets = $applied.assets
            $readback = Invoke-LabCommand pwsh ($common + @('-Mode', 'Verify')) | ConvertFrom-Json -AsHashtable
            Assert-LabCleanupReadback $plan $readback
            $receipt.assets = $readback.assets
            $receipt.closure = $readback.closure
        } else {
            $receipt.status = 'inspection only'
            $receipt.retained = $plan
            $receipt | ConvertTo-Json -Depth 20
            return
        }
    } else {
        $receipt.closure = 'proven closed; no new run-owned processes or mutations started'
    }
    $current = @(Get-LabSharedBaseline $manifest)
    $before = ConvertTo-LabCanonicalJson $baseline.shared
    $after = ConvertTo-LabCanonicalJson $current
    if ($before -cne $after) { throw 'Shared configuration changed; preserve evidence and reconcile through its original owner' }
    $receipt.sharedComparison = 'unchanged selected nonsecret configuration; telemetry content not compared or purged'
    $receipt.status = $(if ($Mode -eq 'Apply' -and -not $WhatIfPreference) { 'verified' } else { 'inspection only' })
} catch {
    $receipt.error = $_.Exception.Message
    $receipt.retained = @($receipt.plan)
    throw
} finally {
    if ($Mode -eq 'Apply' -and -not $WhatIfPreference -and $lock) {
        Write-LabJson (Join-Path $manifest.evidenceRoot 'teardown-receipt.json') $receipt
    }
    if ($lock) { $lock.Dispose() }
    $env:AZURE_CONFIG_DIR = $oldAzure
    $env:AZURE_EXTENSION_USE_DYNAMIC_INSTALL = $oldExtensionInstall
}
$receipt | ConvertTo-Json -Depth 20
