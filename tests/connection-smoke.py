"""Build 7 offline role previews and individual release controls, fictional data only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':920},accept_downloads=True);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
 p.evaluate("""() => {const f=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});Object.defineProperty(window,'localStorage',{configurable:true,value:f()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:f()});window.print=()=>{};window.confirm=()=>true;}""")
 for css in ['styles.css','hub.css','space.css','growth.css','evolution.css','showcase.css','connection.css']:p.add_style_tag(content=(ROOT/css).read_text())
 for js in ['math.js','cloud.js','hub.js','space.js','growth.js','evolution.js','showcase.js','connection.js','app.js']:p.add_script_tag(content=(ROOT/js).read_text())
 p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 assert p.locator('.connect-result').count()==1
 assert p.get_by_role('button',name='Revoke',exact=True).count()==1
 p.screenshot(path=str(ROOT/'assets/family-connect-v7-teacher.png'),full_page=False)
 p.get_by_role('button',name='Parent',exact=True).click();p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 assert p.locator('.connect-result').count()==1
 assert 'Equivalent Fractions Practice' in p.locator('main').inner_text()
 p.screenshot(path=str(ROOT/'assets/family-connect-v7-parent.png'),full_page=False)
 p.get_by_role('button',name='Teacher',exact=True).click();p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 p.get_by_role('button',name='Revoke',exact=True).click()
 p.get_by_role('button',name='Parent',exact=True).click();p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 assert p.locator('.connect-result').count()==0
 p.get_by_role('button',name='Teacher',exact=True).click();p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 p.get_by_role('button',name='Release',exact=True).click()
 p.get_by_role('button',name='Parent',exact=True).click();p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 assert p.locator('.connect-result').count()==1
 p.get_by_role('button',name='Teacher',exact=True).click();p.get_by_role('button',name='Progress & grades',exact=True).click()
 p.locator('#result-form textarea[name=notes]').fill('Reviewed score changed. Private until released again.')
 p.locator('#result-form button[type=submit]').click()
 p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 assert p.get_by_role('button',name='Release',exact=True).count()==1
 p.get_by_role('button',name='Parent',exact=True).click();p.get_by_role('button',name='Progress & grades',exact=True).click()
 assert 'Reviewed score changed.' not in p.locator('main').inner_text()
 assert 'No approved grades available.' in p.locator('main').inner_text()
 p.get_by_role('button',name='Teacher',exact=True).click();p.get_by_role('button',name='Roster & access',exact=True).click()
 c=p.locator('input[data-setting="share_grades"]');assert c.count()==1;c.uncheck()
 p.get_by_role('button',name='Family Connection Lab',exact=True).click()
 p.get_by_role('button',name='Release',exact=True).click()
 assert 'Enable classroom grade sharing' in p.locator('#toast').inner_text()
 p.set_viewport_size({'width':390,'height':844});p.screenshot(path=str(ROOT/'assets/family-connect-v7-mobile.png'),full_page=False)
 size=p.evaluate('({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})');assert size['sw']<=size['cw']+2,size
 assert not errors,errors
 print('PASS v7: draft/release/revoke, verified-linked fictional family preview, edited grade returns to draft, class share disable, mobile')
 b.close()
