# RIA Arrival Timing changelog

## 3.00 (2026-10-07)
Request: "convert the artifact to an standalone html file that can be used at the RIA server itself. should be able to browse over the folders with a button. Also need to push it to GIT."
Moved from a single hand-edited artifact to a source tree with a build step (`tools/build.py`) that inlines CSS, JS, Chart.js and both PowerShell scripts into one offline HTML file. Added folder mode: a *Browse key images folder…* button reads a day (or month) folder directly in the browser, using file Modified times; RIA pickup comes from RIA's own ready.txt, and a banner explains what folder mode cannot show. Google Fonts and the CDN dependency were removed so the page runs on servers without internet. The Scripts button now downloads both the file-list script and the mailbox watcher. Added Node and browser tests.

## 2.01
Request: "is important to highlight that ready.txt and ready1.txt differences on the artifact somehow too".
New section "ready1.txt vs ready.txt: who writes what": handoff diagram, data cards, file-by-file table and a per-sample file timestamp chart. Found that bcrt.settings is stamped at capture, before ready1.txt, so "BCRT output" was renamed "BCRT handoff files" throughout.

## 2.00
Request: "is better if we manage only the KeyImageTiming_2026-10-07_files file and not the summary. then processing can happen in the artifact itself and script doesnt need to compute anything at all".
Script replaced by `RIA_KeyImage_Files_v2.00.ps1` (inventory only). The page derives every figure from the file list; older CSVs still load.

## 1.02
Request: "include the script as a downloadable item on the artifact. draft some instructions on how to use it".
Script download (zip) and the step-by-step guide with a description of every chart.

## 1.01
Request: "a list showing delay /not delayed tag based on a setting (30s) and have histograms and timeseries with this new derived dataset".
Section 9, delay tagging: threshold and measure settings, histogram, time series, per-burst and per-hour charts, filterable sample list, tags in the Excel export.

## 1.00
Request: "create an artifact that user can upload these logfiles and plots these graphs".
First version: KPIs, findings, charts 1–8, burst table, Excel and PNG export.
