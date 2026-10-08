#!/usr/bin/env python3
"""Build the single-file RIA Viewer (Arrival timing + Files explorer).

Inlines src/css, src/js, the vendored Chart.js and the PowerShell scripts into
src/index.html and writes dist/RIA_Viewer_v<VERSION>.html.
Standard library only.  Usage:  python tools/build.py
"""
import datetime, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, DIST = ROOT / "src", ROOT / "dist"

def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

NODE_EXPORT = "if(typeof module!=='undefined')module.exports="

def main():
    version = read("VERSION").strip()
    parts = {
        "{{CSS}}":       read("src/css/styles.css"),
        "{{CHARTJS}}":   read("src/vendor/chartjs/chart.umd.js"),
        "{{CORE}}":      read("src/js/core.js").replace(NODE_EXPORT, "//module.exports="),
        "{{KEYIMG}}":    read("src/js/keyimages.js").replace(NODE_EXPORT, "//module.exports="),
        "{{APP}}":       read("src/js/app.js"),
        "{{EXPLORER}}":  read("src/js/explorer.js"),
        "{{PS1_FILES}}": read("scripts/RIA_KeyImage_Files_v2.00.ps1"),
        "{{PS1_WATCH}}": read("scripts/RIA_Mailbox_Watch_v1.00.ps1"),
        "{{VERSION}}":   version,
        "{{BUILD_DATE}}": datetime.date.today().isoformat(),
    }
    for k in ("{{PS1_FILES}}", "{{PS1_WATCH}}", "{{CHARTJS}}", "{{CORE}}", "{{KEYIMG}}", "{{APP}}", "{{EXPLORER}}"):
        if "</script" in parts[k].lower():
            sys.exit(f"{k} contains </script and cannot be inlined")
    html = read("src/index.html")
    for k, v in parts.items():
        if k not in html and k not in ("{{BUILD_DATE}}",):
            sys.exit(f"placeholder {k} missing from src/index.html")
        html = html.replace(k, v)
    if "{{" in html and "}}" in html.split("{{", 1)[1][:40]:
        sys.exit("unreplaced placeholder: " + html.split("{{", 1)[1][:40])
    DIST.mkdir(exist_ok=True)
    out = DIST / f"RIA_Viewer_v{version}.html"
    out.write_text(html, encoding="utf-8", newline="\n")
    print(f"built {out.relative_to(ROOT)}  ({out.stat().st_size/1024:.0f} KB)")

if __name__ == "__main__":
    main()
