from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':890},device_scale_factor=1)
    page.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
    page.evaluate('''() => { const f=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});Object.defineProperty(window,'localStorage',{configurable:true,value:f()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:f()});window.print=()=>{};window.confirm=()=>true; }''')
    for css in ['styles.css','hub.css','space.css','growth.css']:page.add_style_tag(content=(base/css).read_text())
    for js in ['math.js','cloud.js','hub.js','space.js','growth.js','app.js']:page.add_script_tag(content=(base/js).read_text())
    for label,name in [('Standards & Mastery','mastery-v4-overview.png'),('Teach It Better','remix-v4-overview.png'),('Remember Why','legacy-v4-overview.png')]:
        page.get_by_role('button',name=label,exact=True).click()
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(base/'assets'/name),full_page=False)
        print(name, (base/'assets'/name).stat().st_size)
    b.close()
