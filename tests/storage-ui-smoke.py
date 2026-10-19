"""Build 9 visual UI smoke. Uses isolated in-memory browser context; real crypto tested in Node."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1360,'height':890})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
 page.evaluate("""() => { const s={};const ls={getItem:k=>s[k]??null,setItem:(k,v)=>{s[k]=String(v)},removeItem:k=>{delete s[k]}};Object.defineProperty(window,'localStorage',{configurable:true,value:ls});Object.defineProperty(window,'sessionStorage',{configurable:true,value:ls});window.print=()=>{};window.confirm=()=>true;}""")
 for css in ['styles.css','hub.css','space.css','growth.css','evolution.css','showcase.css','connection.css','storage.css']:page.add_style_tag(content=(ROOT/css).read_text())
 for js in ['math.js','cloud.js','hub.js','space.js','growth.js','evolution.js','showcase.js','connection.js','storage.js']:
  page.add_script_tag(content=(ROOT/js).read_text())
 # about:blank opaque origins cannot use IndexedDB, so only UI tested here.
 page.evaluate('window.TeacherStorage.afterRender=()=>{}')
 page.add_script_tag(content=(ROOT/'app.js').read_text())
 assert page.locator('header h1').inner_text()=='Overview'
 page.get_by_role('button',name='My Storage & Backup',exact=True).click()
 assert page.locator('.ts-storage .st-hero').count()==1
 assert page.locator('h2').filter(has_text='My Classroom Storage & Backup').count()==1
 assert page.locator('input[name=files]').count()==1
 assert page.locator('#storage-backup-form').count()==1
 assert page.locator('#storage-restore-form').count()==1
 assert page.locator('#storage-verify-form').count()==1
 assert 'No off-device backup confirmed' in page.locator('.st-safety').inner_text()
 assert page.get_by_role('button',name='Send to myself / Save to Files').count()==1
 assert 'no identifiable student records' in page.locator('.ts-storage').inner_text().lower() or 'student records' in page.locator('.ts-storage').inner_text().lower()
 page.screenshot(path=str(ROOT/'assets/build9-storage-desktop.png'),full_page=True)
 page.get_by_role('button',name='Parent',exact=True).click()
 assert page.get_by_role('button',name='My Storage & Backup',exact=True).count()==0
 page.get_by_role('button',name='Teacher',exact=True).click()
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Toggle navigation').click()
 page.get_by_role('button',name='My Storage & Backup',exact=True).click()
 page.screenshot(path=str(ROOT/'assets/build9-storage-mobile.png'),full_page=True)
 w=page.evaluate('({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})')
 assert w['width'] <= w['client']+3,w
 assert not errors,errors
 print('PASS Build9 UI: navigation, storage workspace, forms, teacher-only nav, mobile responsive, no page errors')
 b.close()
