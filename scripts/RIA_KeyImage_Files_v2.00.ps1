# RIA_KeyImage_Files_v2.00.ps1  (2026-10-07)
# v2.00: inventory only. Lists every sample folder and every file in it with raw timestamps.
#        No calculations; the RIA arrival timing page does all processing.
#
# Usage:
#   Copy this file into the day folder, e.g. E:\RIA Data\Continuous Logs\key images\2026-10\07
#   then right-click > Run with PowerShell.     (it lists the folder it sits in)
#   Or from anywhere:
#   powershell -ExecutionPolicy Bypass -File .\RIA_KeyImage_Files_v2.00.ps1 -Path "E:\RIA Data\Continuous Logs\key images\2026-10\07"
#
# Output (Desktop by default): KeyImageFiles_<yyyy-MM-dd>.csv
#   Host, Folder, Kind (Folder|File), Name, SizeBytes, Created, Modified
#   Times are local server time, yyyy-MM-dd HH:mm:ss.fff. The script only reads; it changes nothing.

param(
    [string]$Path   = '',
    [string]$OutDir = [Environment]::GetFolderPath('Desktop'),
    [switch]$NoPause
)
if (-not $Path) { $Path = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path } }

$fmt  = 'yyyy-MM-dd HH:mm:ss.fff'
$hostName = $env:COMPUTERNAME
$rows = New-Object System.Collections.Generic.List[object]

$folders = @(Get-ChildItem -LiteralPath $Path -Directory | Sort-Object Name)
Write-Host "Listing $($folders.Count) folders in $Path ..."

foreach ($fo in $folders) {
    $rows.Add([pscustomobject]@{
        Host = $hostName; Folder = $fo.Name; Kind = 'Folder'; Name = ''; SizeBytes = ''
        Created = $fo.CreationTime.ToString($fmt); Modified = $fo.LastWriteTime.ToString($fmt)
    })
    foreach ($x in Get-ChildItem -LiteralPath $fo.FullName -File -Force) {
        $rows.Add([pscustomobject]@{
            Host = $hostName; Folder = $fo.Name; Kind = 'File'; Name = $x.Name; SizeBytes = $x.Length
            Created = $x.CreationTime.ToString($fmt); Modified = $x.LastWriteTime.ToString($fmt)
        })
    }
}

$day   = Split-Path $Path -Leaf
$month = Split-Path (Split-Path $Path -Parent) -Leaf
$out   = Join-Path $OutDir ("KeyImageFiles_{0}-{1}.csv" -f $month, $day)
$rows | Export-Csv $out -NoTypeInformation

Write-Host "$($folders.Count) folders, $($rows.Count - $folders.Count) files"
Write-Host "Saved: $out"
Write-Host "Load this CSV into the RIA continuous sample arrival timing page."
if (-not $NoPause) { Read-Host "Press Enter to close" | Out-Null }
