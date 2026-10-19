from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
BASE=Path(__file__).resolve().parent.parent
im=Image.new('RGB',(1000,680),'white');d=ImageDraw.Draw(im);d.text((90,80),'FICTIONAL MATH HOMEWORK',fill='black');d.text((90,180),'1/2 + 1/4 = 3/4',fill='black');d.rectangle((55,45,930,610),outline='black',width=3)
im.save(BASE/'tests/fictional-homework.png')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.goto('about:blank')
 page.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
 page.evaluate('''() => { const store=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});Object.defineProperty(window,'localStorage',{configurable:true,value:store()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:store()});window.print=()=>{window.__prints=(window.__prints||0)+1};window.confirm=()=>true; }''')
 for css in ['styles.css','hub.css','space.css']:page.add_style_tag(content=(BASE/css).read_text())
 for js in ['math.js','cloud.js','hub.js','space.js','app.js']:page.add_script_tag(content=(BASE/js).read_text())
 assert page.locator('header h1').inner_text()=='Overview'
 page.get_by_role('button',name='School Hub',exact=True).click()
 assert 'Sample Academy' in page.locator('.hub-intro h2').inner_text()
 page.screenshot(path=str(BASE/'assets/school-hub-preview.png'),full_page=True)
 page.get_by_role('button',name='Calendar',exact=True).click()
 assert page.locator('.cal-day').count()>=28
 page.locator('#hub-event-form input[name=title]').fill('Sample art fair')
 page.locator('#hub-event-form button[type=submit]').click()
 assert 'Sample art fair' in page.locator('body').inner_text()
 with page.expect_download() as dd:page.locator('[data-extra=export-calendar]').click()
 assert dd.value.suggested_filename.endswith('.ics')
 page.get_by_role('button',name='Free Resources',exact=True).click()
 assert page.locator('.resource-card').count()>=20
 assert page.locator('#hub-book-form').count()==1
 page.locator('#hub-book-form input[name=title]').fill('Public-domain Sample Book')
 page.locator('#hub-book-form input[name=author]').fill('Sample Author')
 page.locator('#hub-book-form input[name=url]').fill('https://www.gutenberg.org/')
 page.locator('#hub-book-form button[type=submit]').click()
 assert 'Public-domain Sample Book' in page.locator('body').inner_text()
 page.screenshot(path=str(BASE/'assets/resources-preview.png'),full_page=True)
 page.locator('#hub-resource-category').select_option('Career & aptitude')
 assert page.locator('.resource-card').count()>=2
 page.locator('#hub-resource-category').select_option('All')
 page.get_by_role('button',name='Lesson Exchange',exact=True).click()
 assert page.locator('.lesson-card').count()==1
 page.locator('#hub-lesson-form input[name=title]').fill('Another original fraction lesson')
 page.locator('#hub-lesson-form textarea[name=objective]').fill('Learn fraction parts')
 page.locator('#hub-lesson-form textarea[name=steps]').fill('1. Model\n2. Practice\n3. Check understanding')
 page.locator('#hub-lesson-form input[name=rights]').check()
 page.locator('#hub-lesson-form button[type=submit]').click()
 assert page.locator('.lesson-card').count()==2
 with page.expect_download() as dd:page.locator('[data-extra=lesson-export]').first.click()
 assert dd.value.suggested_filename.endswith('.json')
 page.screenshot(path=str(BASE/'assets/lesson-exchange-preview.png'),full_page=True)
 page.get_by_role('button',name='Scan & Review',exact=True).click()
 page.locator('#hub-scan-file').set_input_files(str(BASE/'tests/fictional-homework.png'))
 page.wait_for_function('() => document.getElementById("hub-scan-canvas")?.width>0')
 assert page.locator('#hub-scan-canvas').evaluate('(el)=>el.width')>0
 with page.expect_download() as dd: page.locator('[data-extra=scan-download]').click()
 assert dd.value.suggested_filename.endswith('.png')
 page.locator('#hub-scan-grade input[name=score]').fill('8')
 page.locator('#hub-scan-grade input[name=possible]').fill('10')
 with page.expect_download() as dd:page.locator('#hub-scan-grade button[type=submit]').click()
 assert dd.value.suggested_filename.endswith('.txt')
 page.screenshot(path=str(BASE/'assets/scan-preview.png'),full_page=True)
 page.locator('[data-action=role][data-role=parent]').click()
 assert page.get_by_role('button',name='School Hub',exact=True).count()==1
 page.get_by_role('button',name='School Hub',exact=True).click()
 assert page.locator('#hub-school-form').count()==0
 assert page.get_by_role('button',name='Lesson Exchange',exact=True).count()==0
 print('HUB OK; resources, calendar, lesson exchange, camera-style upload, offline review, parent read-only verified.')
 print('PAGE ERRORS:',errors)
 assert not errors,errors
 browser.close()
