# python tests/smoke_explorer.py <built html> <RIA Data folder> [screenshot dir]   (needs playwright; uses installed Edge)
# Files explorer: nothing loads until Load files; the range and Log limit what is read; viewer, keyboard and lightbox work.
# The native folder picker cannot be automated, so the folder goes in through the webkitdirectory fallback.
import asyncio, sys, pathlib
from playwright.async_api import async_playwright
html, root = sys.argv[1:3]
shots = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
one = lambda t: ' '.join(t.split())

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='msedge')
        pg = await b.new_page(viewport={'width': 1400, 'height': 950})
        errs, ext = [], []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('request', lambda r: ext.append(r.url) if not r.url.startswith(('file:', 'data:', 'blob:')) else None)
        await pg.add_init_script('delete window.showDirectoryPicker')
        await pg.goto(pathlib.Path(html).resolve().as_uri())
        await pg.click('#tabFiles')
        print('start | folder:', await pg.inner_text('#fxRoot'), '| range:', await pg.input_value('#fxFrom'), '->', await pg.input_value('#fxTo'), await pg.inner_text('#fxSpan'), '| button:', await pg.inner_text('#fxLoad'))
        await pg.set_input_files('#fxDir', root)
        await pg.wait_for_timeout(300)
        print('folder picked, before Load | tree:', one(await pg.inner_text('#fxTree')), '| samples:', await pg.locator('.smp').count())
        assert await pg.locator('.smp').count() == 0

        async def load(frm, to, log=''):
            await pg.select_option('#fxLog', log)
            await pg.fill('#fxFrom', frm); await pg.fill('#fxTo', to)
            await pg.click('#fxLoad')
            await pg.wait_for_function("!document.getElementById('fxLoad').disabled&&document.getElementById('fxAvail').textContent.startsWith('Loaded')", timeout=60000)
            print(f'load {log or "both"} {frm}..{to} |', await pg.inner_text('#fxAvail'), '|', one(await pg.inner_text('#fxChips')))

        await load('2026-10-07T00:00', '2026-10-07T23:59:59')
        await pg.select_option('#fxLog', 'Main')
        print('log -> Main before reload | button:', await pg.inner_text('#fxLoad'), '| tree logs:', [one(t) for t in await pg.locator('.tn.l0').all_inner_texts()])
        await load('2026-10-07T09:30', '2026-10-07T09:40', 'Main')
        await load('2026-09-01T00:00', '2026-10-31T23:59:59')

        for log in ('Continuous', 'Main'):
            if await pg.locator(f'.tn.l0[data-k="L|{log}"][aria-expanded=false]').count():
                await pg.click(f'.tn.l0[data-k="L|{log}"]')
            hrs = pg.locator(f'.tn.l2[data-k^="H|{log}|"][aria-expanded=false]')
            if await pg.locator(f'.smp[data-id^="{log}/"]').count() == 0: await hrs.first.click()
            await pg.locator(f'.smp[data-id^="{log}/"]').first.click()
            await pg.wait_for_function("(()=>{const a=[...document.querySelectorAll('#fxImgs .fxfig:not(.miss) img')];return a.length>0&&a.every(i=>i.complete&&i.naturalWidth>0)})()", timeout=20000)
            print(log, '| head:', one(await pg.inner_text('.fxhead')))
            print(log, '| imgs:', [one(t) for t in await pg.locator('#fxImgs figcaption').all_inner_texts()])
            if shots: await pg.screenshot(path=str(shots / f'explorer_{log}.png'))
        await pg.focus('#fxTree'); await pg.keyboard.press('ArrowDown')
        print('keyboard next |', await pg.inner_text('.fxhead h2'))
        await pg.click('#fxImgs .fxfig >> nth=0')
        await pg.wait_for_selector('#lb:not([hidden])')
        print('lightbox |', await pg.inner_text('#lbTitle'), await pg.inner_text('#lbInfo'))
        await pg.keyboard.press('Escape')
        await pg.click('#tabTiming'); print('timing tab visible:', await pg.is_visible('#empty'))
        print('errors', errs, '| external requests', ext)
        await b.close()
        if errs or ext: sys.exit(1)
asyncio.run(main())
