# RIA_Mailbox_Watch_v1.00.ps1  (2026-10-07)
# Read-only watcher for the Key Continuous mailbox. Run it on the RIA server.
# Every poll it lists the mailbox and logs, the first time each file is seen:
#   - when RIA saw it (RIA clock)
#   - the file's own Created / Modified times (stamped by the CFG file system = CFG clock)
# and the time each sample folder disappeared (RIA took it).
# From this you get (1) the CFG-RIA clock offset and (2) when Key/BCRT actually wrote
# ready1.txt and Ready.txt for each sample, which key images cannot show.
# It never writes, moves or deletes anything in the mailbox.
#
# Usage (PowerShell on the RIA server):
#   powershell -ExecutionPolicy Bypass -File .\RIA_Mailbox_Watch_v1.00.ps1
#   powershell -ExecutionPolicy Bypass -File .\RIA_Mailbox_Watch_v1.00.ps1 -Minutes 65 -IntervalMs 250
# Let it run through at least one burst (bursts come about every 30 min). Ctrl+C is safe:
# rows are written to the CSV as they are found.

param(
    [string]$Mailbox    = '\\26.134.20.12\DigitalDefects\GraftekMailbox\Continuous',
    [int]   $Minutes    = 40,
    [int]   $IntervalMs = 250,
    [string]$OutDir     = [Environment]::GetFolderPath('Desktop')
)

$fmt   = 'yyyy-MM-dd HH:mm:ss.fff'
$stamp = Get-Date -Format 'yyyy-MM-dd_HH.mm'
$out   = Join-Path $OutDir "MailboxWatch_$stamp.csv"
$seen  = @{}      # "folder|file" -> $true
$live  = @{}      # folder -> $true while present
$first = $true    # files already there on the first scan are flagged, they were not seen arriving
$end   = (Get-Date).AddMinutes($Minutes)
$header = $true

if (-not (Test-Path -LiteralPath $Mailbox)) { Write-Warning "Cannot reach $Mailbox"; Read-Host "Press Enter to close" | Out-Null; return }
Write-Host "Watching $Mailbox every $IntervalMs ms until $($end.ToString('HH:mm:ss')). Output: $out"
Write-Host "Ctrl+C to stop early; rows already found are kept."

function Emit($rows) {
    if ($rows.Count -eq 0) { return }
    if ($script:header) { $rows | Export-Csv $out -NoTypeInformation; $script:header = $false }
    else { $rows | Export-Csv $out -NoTypeInformation -Append }
}

while ((Get-Date) -lt $end) {
    $rows = New-Object System.Collections.Generic.List[object]
    try {
        $now  = Get-Date
        $dirs = @(Get-ChildItem -LiteralPath $Mailbox -Directory -ErrorAction Stop)
        $top  = @(Get-ChildItem -LiteralPath $Mailbox -File -ErrorAction SilentlyContinue)

        foreach ($f in $top) {
            $k = "(top)|$($f.Name)|$($f.LastWriteTime.Ticks)"
            if (-not $seen.ContainsKey($k)) {
                $seen[$k] = $true
                $rows.Add([pscustomobject]@{ Event='FileSeen'; Folder='(top level)'; File=$f.Name; SeenOnRIA=$now.ToString($fmt)
                    CreatedCFG=$f.CreationTime.ToString($fmt); ModifiedCFG=$f.LastWriteTime.ToString($fmt)
                    SeenMinusModified_s=[math]::Round(($now - $f.LastWriteTime).TotalSeconds,3); PresentAtStart=$first })
            }
        }
        $present = @{}
        foreach ($d in $dirs) {
            $present[$d.Name] = $true
            if (-not $live.ContainsKey($d.Name)) {
                $live[$d.Name] = $true
                $rows.Add([pscustomobject]@{ Event='FolderSeen'; Folder=$d.Name; File=''; SeenOnRIA=$now.ToString($fmt)
                    CreatedCFG=$d.CreationTime.ToString($fmt); ModifiedCFG=$d.LastWriteTime.ToString($fmt)
                    SeenMinusModified_s=[math]::Round(($now - $d.CreationTime).TotalSeconds,3); PresentAtStart=$first })
            }
            foreach ($f in @(Get-ChildItem -LiteralPath $d.FullName -File -Force -ErrorAction SilentlyContinue)) {
                $k = "$($d.Name)|$($f.Name)"
                if (-not $seen.ContainsKey($k)) {
                    $seen[$k] = $true
                    $rows.Add([pscustomobject]@{ Event='FileSeen'; Folder=$d.Name; File=$f.Name; SeenOnRIA=$now.ToString($fmt)
                        CreatedCFG=$f.CreationTime.ToString($fmt); ModifiedCFG=$f.LastWriteTime.ToString($fmt)
                        SeenMinusModified_s=[math]::Round(($now - $f.LastWriteTime).TotalSeconds,3); PresentAtStart=$first })
                }
            }
        }
        foreach ($name in @($live.Keys)) {
            if (-not $present.ContainsKey($name)) {
                $live.Remove($name)
                $rows.Add([pscustomobject]@{ Event='FolderGone'; Folder=$name; File=''; SeenOnRIA=$now.ToString($fmt)
                    CreatedCFG=''; ModifiedCFG=''; SeenMinusModified_s=''; PresentAtStart=$false })
            }
        }
        $first = $false
    } catch {
        $rows.Add([pscustomobject]@{ Event='Error'; Folder=''; File=$_.Exception.Message; SeenOnRIA=(Get-Date).ToString($fmt)
            CreatedCFG=''; ModifiedCFG=''; SeenMinusModified_s=''; PresentAtStart=$false })
    }
    Emit $rows
    Start-Sleep -Milliseconds $IntervalMs
}

# Clock offset estimate: header.txt files that appeared while we were watching.
if (Test-Path $out) {
    $h = @(Import-Csv $out | Where-Object { $_.Event -eq 'FileSeen' -and $_.File -eq 'header.txt' -and $_.PresentAtStart -eq 'False' } |
           ForEach-Object { [double]$_.SeenMinusModified_s })
    if ($h.Count) {
        $s = $h | Sort-Object
        Write-Host ("`nheader.txt seen {0} times while watching. RIA-seen minus CFG-written: min {1} s, median {2} s" -f $h.Count, $s[0], $s[[int]($s.Count/2)])
        Write-Host "The minimum is the clock offset plus the polling delay (up to $IntervalMs ms)."
        Write-Host "Near 0 to $([math]::Round($IntervalMs/1000+0.3,1)) s: clocks agree. Negative: RIA clock is behind the CFG. Several seconds or more: RIA clock is ahead or the share is slow."
    } else { Write-Host "`nNo new samples arrived while watching; run it longer (-Minutes 65)." }
}
Write-Host "Saved: $out"
Read-Host "Press Enter to close" | Out-Null
