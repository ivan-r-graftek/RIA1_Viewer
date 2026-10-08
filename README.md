# RIA Arrival Timing

Single-file HTML tool that shows when each RIA Continuous sample became available to RIA, and where the transfer time goes (Key / BCRT handoff vs. RIA). Built for IH-5274 (York PC1) and usable on any RIA 1.0 site.

It works offline and can run directly on the RIA server: open the HTML in Edge or Chrome and browse to a `key images` day folder (`E:\RIA Data\Continuous Logs\key images\<yyyy-MM>\<dd>`), or load the CSV produced by the PowerShell script.

## Repository layout

```
VERSION                         current version (x.xx)
RIA_Arrival_Timing_CHANGELOG.md full history, newest first
src/
  index.html                    page template with {{PLACEHOLDERS}}
  css/styles.css
  js/core.js                    parsing + analysis, no DOM (testable in Node)
  js/app.js                     UI, charts, exports
  vendor/chartjs/               Chart.js 4.4.1 UMD build + licence (inlined at build)
scripts/
  RIA_KeyImage_Files_v2.00.ps1  lists a key images day folder -> KeyImageFiles_<date>.csv
  RIA_Mailbox_Watch_v1.00.ps1   read-only watcher for the Key Continuous mailbox
tools/build.py                  inlines everything into dist/RIA_Arrival_Timing_v<VERSION>.html
tests/
  test_core.js                  Node test: CSV path and folder path agree on the fixture
  smoke_browser.py              Playwright smoke test of the built page (optional)
  fixtures/KeyImageFiles_sample.csv
dist/                           build output (git-ignored)
```

The source is the source of truth; the HTML in `dist/` is a build product. Both PowerShell scripts are embedded in the page (Scripts button) and also kept as plain files in `scripts/`.

## Build and test

Requires Python 3 (standard library only) and, for the tests, Node.js.

```
python tools/build.py          # -> dist/RIA_Arrival_Timing_v3.00.html
node tests/test_core.js        # analysis checks
python tests/smoke_browser.py dist/RIA_Arrival_Timing_v3.00.html <KeyImageFiles csv> <key images day folder>   # optional
```

## Releasing a new version

1. Bump `VERSION` using x.xx: minor (`3.01`) for fixes and small additions, major (`4.00`) for big changes.
2. Add an entry to the top of `RIA_Arrival_Timing_CHANGELOG.md`.
3. If a script changes, give it a new versioned file name in `scripts/` and update the placeholders/paths in `tools/build.py` and the guide text in `src/index.html`.
4. `python tools/build.py`, `node tests/test_core.js`, open the built file and load a real day.
5. Commit, tag and publish:
   ```
   git commit -am "v3.01: <summary>"
   git tag v3.01
   git push && git push --tags
   ```
   Attach `dist/RIA_Arrival_Timing_v3.01.html` to the release for the tag (GitHub/GitLab Releases). That attached file is what goes to RIA servers.

## Using it

See the in-page **Guide**. In short:

- **On the RIA server:** copy the HTML to the server, open it, click *Browse key images folder…*, select the day folder and confirm the browser's "Upload N files" prompt (nothing is uploaded; only file names and Modified times are read).
- **Elsewhere:** run `RIA_KeyImage_Files_v2.00.ps1` in the day folder, then load `KeyImageFiles_<date>.csv`. The CSV also has Created times, which give exact RIA copy times.

### Folder mode vs. CSV mode

Browsers expose only a file's Modified time. In folder mode RIA pickup is taken from RIA's own `ready.txt` (end of the copy) instead of the first file's Created time. On the 2026-10-07 York data this changes the wait count from 65 to 68 (copies took up to ~4 s before 03:00) and leaves sample counts, completeness and the 30 s timeout pattern unchanged. Copy time (chart 7) and the ready.txt Created = Modified check need the CSV.

## Licences

Chart.js is MIT-licensed; see `src/vendor/chartjs/LICENSE.md`.
