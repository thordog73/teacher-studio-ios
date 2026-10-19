from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=Path(__file__).parent.parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
    page.goto('about:blank')
    page.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
    page.evaluate('''() => {
      const store=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});
      Object.defineProperty(window,'localStorage',{configurable:true,value:store()});
      Object.defineProperty(window,'sessionStorage',{configurable:true,value:store()});
      window.print=()=>{window.__prints=(window.__prints||0)+1};
      window.confirm=()=>true;
    }''')
    page.add_style_tag(content=(BASE/'styles.css').read_text())
    page.add_style_tag(content=(BASE/'hub.css').read_text())
    page.add_style_tag(content=(BASE/'space.css').read_text())
    page.add_style_tag(content=(BASE/'hub.css').read_text())
    for js in ['math.js','cloud.js','hub.js','space.js','app.js']:
        page.add_script_tag(content=(BASE/js).read_text())
    print('HOME:',page.locator('header h1').inner_text())
    print('STATS:',page.locator('.stat .num').all_text_contents())
    page.screenshot(path=str(BASE/'assets/dashboard-preview.png'),full_page=True)
    page.get_by_role('button',name='Worksheet Factory',exact=True).click()
    print('WORKSHEET:',page.locator('.paper-preview').inner_text()[:80].replace('\n',' '))
    page.locator('#worksheet-form select[name=count]').select_option('20')
    page.locator('#worksheet-form button[type=submit]').click()
    page.locator('[data-action=print-worksheet]').click()
    print('PRINT CALLED:',page.evaluate('window.__prints'))
    page.get_by_role('button',name='Classroom Arcade',exact=True).click()
    page.locator('#arcade-form button[type=submit]').click()
    print('QUESTION:',page.locator('.practice-question').inner_text())
    page.locator('#arcade-answer-form input').fill('999')
    page.locator('#arcade-answer-form button[type=submit]').click()
    print('FEEDBACK:',page.locator('.feedback').inner_text()[:130])
    page.locator('[data-action=arcade-next]').click()
    print('NEXT:',page.locator('.practice-question').inner_text())
    page.get_by_role('button',name='Roster & access',exact=True).click()
    print('ROSTER:',page.locator('.table tbody tr').count())
    page.locator('#student-form input[name=name]').fill('Fictional Student')
    page.locator('#student-form button[type=submit]').click()
    print('ROSTER AFTER ADD:',page.locator('.table tbody tr').count())
    page.get_by_role('button',name='Assignments',exact=True).click()
    page.locator('#assignment-form input[name=title]').fill('New fraction practice')
    page.locator('#assignment-form button[type=submit]').click()
    print('ASSIGNMENTS:',page.locator('.list-item').count())
    page.get_by_role('button',name='Family messages',exact=True).click()
    page.locator('#message-form textarea[name=body]').fill('Hello fictional families')
    page.locator('#message-form button[type=submit]').click()
    print('MESSAGES:',page.locator('.bubble').count())
    page.locator('[data-action=role][data-role=parent]').click()
    print('PARENT HOME:',page.locator('header h1').inner_text())
    page.get_by_role('button',name='Assignments',exact=True).click()
    print('PARENT ASSIGNMENTS:',page.locator('.card h3').all_text_contents()[:4])
    print('ERRORS:',errors)
    assert not errors,errors
    browser.close()
