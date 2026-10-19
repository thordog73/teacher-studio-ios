"""Build 5 new workflows with fictional data only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':950},accept_downloads=True); errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
 p.evaluate("""() => {const f=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});Object.defineProperty(window,'localStorage',{configurable:true,value:f()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:f()});window.print=()=>{};window.confirm=()=>true;}""")
 for css in ['styles.css','hub.css','space.css','growth.css','evolution.css']:p.add_style_tag(content=(ROOT/css).read_text())
 for js in ['math.js','cloud.js','hub.js','space.js','growth.js','evolution.js','app.js']:p.add_script_tag(content=(ROOT/js).read_text())
 p.get_by_role('button',name='Visual Math Lab',exact=True).click()
 assert p.locator('.evo-pieces').count()==2
 assert p.locator('.evo-pieces .filled').count()==3
 p.get_by_role('button',name='Yes',exact=True).click()
 assert 'Correct reasoning' in p.locator('.evo-feedback').inner_text()
 p.get_by_role('button',name='Next fresh example').click()
 p.get_by_role('button',name='Number lines').click()
 assert p.locator('.evo-numberline').count()==2
 p.screenshot(path=str(ROOT/'assets/visual-math-v5.png'),full_page=False)
 p.get_by_role('button',name='Teach It Better',exact=True).click()
 p.locator('#growth-remix-form input[name=title]').fill('My favorite fraction lesson')
 p.locator('#growth-remix-form textarea[name=notes]').fill('Have students make paper fraction strips.')
 p.locator('#growth-remix-form button[type=submit]').click()
 p.get_by_role('button',name='Classroom Kit',exact=True).click()
 assert p.locator('select[name=remixId]').count()==1
 p.locator('select[name=remixId]').select_option(index=1)
 p.locator('#kit-form button[type=submit]').click()
 assert 'YOUR KIT IS READY' in p.locator('main').inner_text()
 p.get_by_role('button',name='Save in My Kits').click()
 assert 'Saved to My Kits' in p.locator('#toast').inner_text()
 kitseed=p.evaluate("() => JSON.parse(localStorage.getItem('teacherstudio_evolution_v5')).classes['demo-class'].kits[0].kit.seed")
 p.get_by_role('button',name='My Saved Kits',exact=True).click()
 assert p.locator('.evo-saved').count()==1
 p.get_by_role('button',name='Open in Classroom Kit').click()
 assert 'YOUR KIT IS READY' in p.locator('main').inner_text()
 assert 'My favorite fraction lesson' in p.evaluate('''() => JSON.parse(localStorage.getItem('teacherstudio_evolution_v5')).classes['demo-class'].kits[0].kit.customLesson.title''')
 assert kitseed in p.evaluate("() => JSON.parse(localStorage.getItem('teacherstudio_evolution_v5')).classes['demo-class'].kits[0].kit.seed")
 p.get_by_role('button',name='My Saved Kits',exact=True).click()
 p.screenshot(path=str(ROOT/'assets/saved-kits-v5.png'),full_page=False)
 p.get_by_role('button',name='Roster & access',exact=True).click();p.locator('#class-form input[name=name]').fill('Fictional Other Classroom');p.locator('#class-form button[type=submit]').click()
 p.get_by_role('button',name='My Saved Kits',exact=True).click();assert p.locator('.evo-saved').count()==0
 p.get_by_role('button',name='Parent',exact=True).click();assert p.get_by_role('button',name='My Saved Kits',exact=True).count()==0
 p.set_viewport_size({'width':390,'height':844});size=p.evaluate('({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})');assert size['sw']<=size['cw']+2,size
 assert not errors,errors
 print('PASS v5: model visuals, exact lesson->kit->save->reload, per-class isolation, parent restrictions, mobile viewport')
 b.close()
