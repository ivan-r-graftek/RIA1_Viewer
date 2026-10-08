# RIA Viewer

Single-file, offline HTML viewer for RIA 1.0 station data. Usable on any RIA 1.0 site, directly on the RIA server.

- **Arrival timing**: when each RIA Continuous sample became available to RIA, and where the transfer time goes (Key / BCRT handoff vs. RIA). Built for IH-5274 (York PC1).
- **Files explorer**: browse `E:\RIA Data` by time range. The **Key images** sub-tab lists Main Logs and Continuous Logs samples in a tree, typed from `header.txt` as In-Bag, Mini-Dump or Fryer Exit, and shows the images with the key header fields. Calibrations and Results sub-tabs are placeholders for now.

It works offline and can run directly on the RIA server: open the HTML in Edge or Chrome and browse to a `key images` day folder (`E:\RIA Data\Continuous Logs\key images\<yyyy-MM>\<dd>`), or load the CSV produced by the PowerShell script.

## Repository layout

```
VERSION                         current version (x.xx)
RIA_Viewer_CHANGELOG.md full history, newest first
src/
  index.html                    page template with {{PLACEHOLDERS}}
  css/styles.css
  js/core.js                    arrival timing: parsing + analysis, no DOM (testable in Node)
  js/app.js                     arrival timing: UI, charts, exports
  js/keyimages.js               files explorer: folder walk, header.txt parsing, sample typing, no DOM (testable in Node)
  js/explorer.js                files explorer: tabs, tree, sample viewer, image lightbox
  vendor/chartjs/               Chart.js 4.4.1 UMD build + licence (inlined at build)
scripts/
  RIA_KeyImage_Files_v2.00.ps1  lists a key images day folder -> KeyImageFiles_<date>.csv
  RIA_Mailbox_Watch_v1.00.ps1   read-only watcher for the Key Continuous mailbox
tools/build.py                  inlines everything into dist/RIA_Viewer_v<VERSION>.html
tests/
  test_core.js                  Node test: CSV path and folder path agree on the fixture
  test_keyimages.js             Node test: header typing, and scan/index over Examples/RIA_Data if present
  smoke_browser.py              Playwright smoke test of the arrival timing tab (optional)
  smoke_explorer.py             Playwright smoke test of the files explorer, using installed Edge (optional)
  fixtures/KeyImageFiles_sample.csv
dist/                           build output (git-ignored)
Examples/RIA_Data/              local sample of an RIA Data folder for testing (git-ignored, ~1.6 GB)
```

The source is the source of truth; the HTML in `dist/` is a build product. Both PowerShell scripts are embedded in the page (Scripts button) and also kept as plain files in `scripts/`.

## Build and test

Requires Python 3 (standard library only) and, for the tests, Node.js.

```
python tools/build.py          # -> dist/RIA_Viewer_v4.02.html
node tests/test_core.js        # arrival timing checks
node tests/test_keyimages.js   # files explorer checks (uses Examples/RIA_Data when present)
python tests/smoke_browser.py dist/RIA_Viewer_v4.02.html <KeyImageFiles csv> <key images day folder>   # optional
python tests/smoke_explorer.py dist/RIA_Viewer_v4.02.html Examples/RIA_Data                           # optional
```

## Releasing a new version

1. Bump `VERSION` using x.xx: minor (`3.01`) for fixes and small additions, major (`4.00`) for big changes.
2. Add an entry to the top of `RIA_Viewer_CHANGELOG.md`.
3. If a script changes, give it a new versioned file name in `scripts/` and update the placeholders/paths in `tools/build.py` and the guide text in `src/index.html`.
4. `python tools/build.py`, `node tests/test_core.js`, open the built file and load a real day.
5. Commit, tag and publish:
   ```
   git commit -am "v3.01: <summary>"
   git tag v3.01
   git push && git push --tags
   ```
   Attach `dist/RIA_Viewer_v3.01.html` to the release for the tag (GitHub/GitLab Releases). That attached file is what goes to RIA servers.

## Using it

### Files explorer

Open the **Files explorer** tab. Nothing is read until you click **Load files**, so a server with thousands of sample folders is never listed in full.

1. **Folder** defaults to `E:\RIA Data`. Browsers cannot open a folder from its path, so the first **Load files** asks you to pick it once; the choice is remembered (IndexedDB) and later launches only ask to allow access. **Change…** picks another folder: `Main Logs`, `Continuous Logs`, a `key images` folder, or a single month or day folder.
2. **Log** chooses Main + Continuous, Main Logs or Continuous Logs (`<log>\key images` under the folder).
3. **From / To** starts as the 24 hours before the page was opened. Presets (last hour, 8 hours, 24 hours, today, 7 days) also end at the launch time.
4. **Load files** opens only the month and day folders that overlap the range, keeps the sample folders whose timestamp is inside it, and reads their file list and `header.txt`. Above 3000 samples it asks first. Each load replaces the previous one. Changing the range or log afterwards marks the button "selection changed"; changing only the log filters what is already loaded.
5. Images are read only when a sample is selected: `frameGrab.bmp` for Continuous Logs; `frameGrab0/1.png` (left/right) and `segmented0/1.png` for Main Logs.

Sample type comes from the `[Acquisition ID]` section of `header.txt`:

| Log | Typed by | Types |
| --- | --- | --- |
| Continuous Logs | `RecycleContent` | In-Bag, Mini-Dump. Mini-Dump needs both `RecycleContent` and `FryerContent` = Mini-Dump; `RecycleContent=In-Bag` with `FryerContent=Mini-Dump` is flagged as a Key mis-tag (runbook: *Mini-Dump Results Not Being Generated*). |
| Main Logs | `FryerContent` | Fryer Exit, Mini-Dump (runbook: *Fryer Exit Cumulative Logs Not Updating*). |

Other values (Normalization, Calibration, …) are listed as they are. Folders without `header.txt` are listed with a warning. Browsers without the folder picker (not Edge or Chrome) fall back to a folder upload, which lists every file in the chosen folder up front; pick a `key images` day folder there, not all of RIA Data. Empty folders are not visible in that mode.

### Arrival timing

See the in-page **Guide**. In short:

- **On the RIA server:** copy the HTML to the server, open it, click *Browse key images folder…*, select the day folder and confirm the browser's "Upload N files" prompt (nothing is uploaded; only file names and Modified times are read).
- **Elsewhere:** run `RIA_KeyImage_Files_v2.00.ps1` in the day folder, then load `KeyImageFiles_<date>.csv`. The CSV also has Created times, which give exact RIA copy times.

### Folder mode vs. CSV mode

Browsers expose only a file's Modified time. In folder mode RIA pickup is taken from RIA's own `ready.txt` (end of the copy) instead of the first file's Created time. On the 2026-10-07 York data this changes the wait count from 65 to 68 (copies took up to ~4 s before 03:00) and leaves sample counts, completeness and the 30 s timeout pattern unchanged. Copy time (chart 7) and the ready.txt Created = Modified check need the CSV.

## Licences

Chart.js is MIT-licensed; see `src/vendor/chartjs/LICENSE.md`.
