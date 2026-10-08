# RIA Viewer changelog (formerly RIA Arrival Timing)

## 4.02 (2026-10-07)
Request: "because folders can be thousands lets change the logic a little bit. Folder presets to E:\RIA Data. Can change if needed. but dont load any files or index yet. Only load and index based on the data range selection. Predefine this to launch time of html file back to 1 day. Then one large button that says "load files" this will index and load. This way we make sure only a limited amount of folders / files are loaded and dont oversaturate the memory"
The Files explorer no longer reads anything when a folder is chosen. The folder defaults to `E:\RIA Data`; browsers cannot open a path by name, so the first **Load files** asks for it once and the handle is remembered in IndexedDB (later launches only ask to allow access). **Change…** picks another folder without reading it. From / To defaults to the 24 hours before the page was opened, and the presets (last hour, 8 h, 24 h, today, 7 days) end at the launch time. The new **Load files** button opens only the month and day folders that overlap the range, keeps the sample folders whose timestamp is inside it, and reads their file list and `header.txt`; above 3000 samples it asks first, and each load replaces the previous one and frees its images. Changing the range or log after a load marks the button "selection changed". In `keyimages.js`, `kiScan` / `kiIndex` (list every day folder, then index whole days) were replaced by `kiFind` / `kiLoad` (open only what the range needs); the tests now check that a one-day range never opens other months or any sample folder before loading. Starting with this version every change gets its own revision number, per the request "remember to always create a reviion up based on modifications so we can trace it"; 4.00 to 4.02 were split out of one working session after the fact.

## 4.01 (2026-10-07)
Request: "it will autodetect if continuous or main logs when Opening RIA folder? should have a drop down meny"
Added a **Log** drop-down to the Files explorer (All logs, Main Logs, Continuous Logs). Logs are detected from the `Main Logs` / `Continuous Logs` folder names, or from the image files inside a `key images` folder (`frameGrab.bmp` = Continuous, `frameGrab0/1.png` = Main); logs not found are disabled and a single found log is preselected. Choosing one log limits both indexing and the tree to it.

## 4.00 (2026-10-07)
Request: "Lets have a tab called "files explorer". Include a time range selector for indexing folders and viewers. This tab will have three subtabs: key images, calibrations and results. Will start with key images: on the left side there is a explorer like tree listing the files that a user can select. upon selection, images will show on the right side along the critical information from header. When indexing the folders script needs to go over the headers and differentiate between the different MiniDump, In-bag or FE types of images so they are clearly differentiated. for image display, only one image from continuos (since is only one there) and the two framegrabs and segmented from the main logs folders."
The tool becomes the RIA Viewer with two tabs; the build output is now `dist/RIA_Viewer_v<VERSION>.html` and this changelog is renamed `RIA_Viewer_CHANGELOG.md`. The existing arrival timing tool is unchanged under **Arrival timing**. The new **Files explorer** opens an RIA Data folder with the browser's folder picker (webkitdirectory fallback) and indexes `header.txt` for the days in a From / To range. The **Key images** sub-tab shows a Log > day > hour > sample tree with In-Bag / Mini-Dump / Fryer Exit badges, type filter chips, a warnings filter and keyboard navigation. The viewer shows the key header fields, the marker files present, the raw header and the images (Continuous: `frameGrab.bmp`; Main: `frameGrab0/1` and `segmented0/1`), with a zoom/pan lightbox. Typing rules come from the RIA Mailbox Server Protocol v3.2 and the runbook pages on Mini-Dump and Fryer Exit header tags: Continuous Logs are typed by `RecycleContent` (a Mini-Dump needs both fields set to Mini-Dump; In-Bag with FryerContent Mini-Dump is flagged as a Key mis-tag), Main Logs by `FryerContent`. Calibrations and Results are placeholder sub-tabs. Added `tests/test_keyimages.js` and `tests/smoke_explorer.py`.

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
