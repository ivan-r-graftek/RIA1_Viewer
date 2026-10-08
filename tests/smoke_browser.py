# python tests/smoke_browser.py <built html> <csv> <day folder>   (needs playwright + chromium)
import asyncio,sys
from playwright.async_api import async_playwright
html,csvf,day=sys.argv[1:4]
async def run(mode):
  async with async_playwright() as p:
    b=await p.chromium.launch();pg=await b.new_page(viewport={'width':1280,'height':900})
    errs=[];ext=[]
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.on('request',lambda r: ext.append(r.url) if not r.url.startswith(('file:','data:','blob:')) else None)
    await pg.goto('file://'+html)
    if mode=='csv': await pg.set_input_files('#file',csvf)
    else: await pg.set_input_files('#dir',day)
    await pg.wait_for_selector('#app:not([hidden])',timeout=20000);await pg.wait_for_timeout(800)
    k=await pg.inner_text('#kpis');print(mode,'|',k.replace('\n',' '));print(mode,'| modeNote hidden:',await pg.get_attribute('#modeNote','hidden') is not None, '| rKpis:',(await pg.inner_text('#rKpis')).replace('\n',' '))
    if mode=='folder':
      await pg.evaluate("document.querySelectorAll('details.sec').forEach(d=>d.open=true)");await pg.wait_for_timeout(400)
      await pg.screenshot(path='/home/claude/fold.png',full_page=False)
      async with pg.expect_download() as d: await pg.click('#dlScript')
      await (await d.value).save_as('/home/claude/scripts.zip')
    print(mode,'| errors',errs,'| external requests',ext);await b.close()
for m in ('csv','folder'): asyncio.run(run(m))
