#Requires -Version 7.2
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$TestRunId,
    [Parameter(Mandatory)][string]$ManifestPath,
    [string]$ConfigurationPath,
    [ValidateSet('Inspect', 'Apply')][string]$Mode = 'Inspect'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LabDeliveryTest.psm1') -Force -DisableNameChecking

if (Test-Path -LiteralPath $ManifestPath) {
    $manifest = Read-LabManifest $TestRunId $ManifestPath
    if ($manifest.delivery.started -or
        ($manifest.delivery.Contains('executionRequested') -and $manifest.delivery.executionRequested)) {
        throw 'A requested or started delivery is not a fresh test; reconcile it and use a new test-run identity'
    }
} elseif ($ConfigurationPath) {
    $manifest = Get-Content -LiteralPath $ConfigurationPath -Raw | ConvertFrom-Json -AsHashtable
    Assert-LabManifest $manifest $TestRunId $ManifestPath
} else { throw 'A fresh cycle requires an explicit private configuration or an unexecuted setup manifest' }

$receiptPath = Join-Path $manifest.evidenceRoot 'lifecycle-receipt.json'
if (Test-Path -LiteralPath $receiptPath) { throw 'This cycle already has a receipt; do not silently repeat execution' }
if ($Mode -eq 'Inspect' -or $WhatIfPreference) {
    @{ testRunId = $TestRunId; mode = 'inspection only'; repository = $manifest.repository
        flow = @('setup', 'execute', 'teardown'); setup = @('Inventory', 'Reset', 'Bootstrap', 'Issues')
        resume = $false; receiptPath = $receiptPath; automaticMutations = $false } | ConvertTo-Json -Depth 5
    return
}
if (-not $PSCmdlet.ShouldProcess($TestRunId, 'Run fresh setup, one delivery and guarded teardown even on failure')) { return }

[void][IO.Directory]::CreateDirectory($manifest.evidenceRoot)
$lockPath = "$ManifestPath.cycle.lock"
Assert-LabUnlinkedPath $lockPath
$lock = [IO.File]::Open($lockPath, 'CreateNew', 'ReadWrite', 'None')
$oldAzure = $env:AZURE_CONFIG_DIR
$oldExtensionInstall = $env:AZURE_EXTENSION_USE_DYNAMIC_INSTALL
try {
    $setupScript = Join-Path $PSScriptRoot 'Setup-LabDeliveryTest.ps1'
    $teardownScript = Join-Path $PSScriptRoot 'Teardown-LabDeliveryTest.ps1'
    $setup = {
        if (-not (Test-Path -LiteralPath $ManifestPath)) {
            $inventory = & $setupScript -TestRunId $TestRunId -ManifestPath $ManifestPath `
                -ConfigurationPath $ConfigurationPath -Stage Inventory -Mode Apply | ConvertFrom-Json -AsHashtable
            Write-LabJson (Join-Path $manifest.evidenceRoot 'setup-inventory-receipt.json') $inventory
        }
        foreach ($stage in @('Reset', 'Bootstrap', 'Issues')) {
            $result = & $setupScript -TestRunId $TestRunId -ManifestPath $ManifestPath -Stage $stage -Mode Apply |
                ConvertFrom-Json -AsHashtable
            Write-LabJson (Join-Path $manifest.evidenceRoot "setup-$($stage.ToLowerInvariant())-receipt.json") $result
        }
    }.GetNewClosure()
    $execute = {
        $current = Read-LabManifest $TestRunId $ManifestPath
        Set-LabAzureScope $current
        $current.delivery.executionRequested = $true
        $current.delivery.started = $true
        $current.delivery.stopped = $false
        Write-LabJson $ManifestPath $current
        $resultPath = Join-Path $current.evidenceRoot 'workflow-result.json'
        if (Test-Path -LiteralPath $resultPath) {
            throw 'Execution artifacts already exist; refusing another invocation'
        }
        $inputPath = Join-Path $current.repositoryRoot '.github\delivery-input.json'
        Push-Location -LiteralPath $current.repositoryRoot
        try {
            & copilot -C $current.repositoryRoot workflow run issue-driven-delivery `
                --args "@$inputPath" --result-file $resultPath 2>&1 |
                ForEach-Object { Write-Host $_ }
            $code = $LASTEXITCODE
        } finally { Pop-Location }
        $current = Read-LabManifest $TestRunId $ManifestPath
        $current.delivery.exitCode = $code
        Write-LabJson $ManifestPath $current
        if ($code -ne 0) { throw "Workflow command failed (exit $code); inspect its recorded owning Copilot session" }
        $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json -AsHashtable
        if ($result.status -cne 'done') { throw "Workflow did not deliver the queue: $($result.status)" }
    }.GetNewClosure()
    $teardown = {
        try {
            $current = Read-LabManifest $TestRunId $ManifestPath
            $observed = Assert-LabQuiescent $current -CurrentRunOnly
            if ($current.delivery.Contains('executionRequested') -and $current.delivery.executionRequested) {
                $baseline = Get-Content -LiteralPath $current.inventoryPath -Raw | ConvertFrom-Json -AsHashtable
                $known = @($baseline.runs.runs | ForEach-Object runId)
                $created = @($observed.runs | Where-Object { $_.runId -cnotin $known })
                if ($created.Count -gt 1) { throw 'Multiple new workflow runs; ownership requires reconciliation' }
                $current.delivery.started = $created.Count -eq 1
                if ($created.Count) {
                    $current.delivery.sessionId = $created[0].sessionId
                    $current.delivery.runId = $created[0].runId
                    $current.delivery.status = $created[0].status
                }
            }
            $current.delivery.stopped = $true
            Write-LabJson $ManifestPath $current
        } finally {
            $result = & $teardownScript -TestRunId $TestRunId -ManifestPath $ManifestPath -Mode Apply |
                ConvertFrom-Json -AsHashtable
            Write-LabJson (Join-Path $manifest.evidenceRoot 'cycle-teardown-receipt.json') $result
        }
    }.GetNewClosure()
    $receipt = Invoke-LabLifecycle -TestRunId $TestRunId -Setup $setup -Execute $execute -Teardown $teardown -ReceiptPath $receiptPath
    $receipt | ConvertTo-Json -Depth 10
    if ($receipt.status -cne 'passed') { throw "Test cycle failed; inspect $receiptPath for separate execution and teardown verdicts" }
} finally {
    $env:AZURE_CONFIG_DIR = $oldAzure
    $env:AZURE_EXTENSION_USE_DYNAMIC_INSTALL = $oldExtensionInstall
    $lock.Dispose()
    if (Test-Path -LiteralPath $receiptPath) { Remove-Item -LiteralPath $lockPath }
}
