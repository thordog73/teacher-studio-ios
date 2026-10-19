from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'web'
styles=['styles.css','hub.css','space.css','growth.css','evolution.css','showcase.css','connection.css','family.css','storage.css']
scripts=['math.js','pilot-config.js','cloud.js','hub.js','space.js','growth.js','evolution.js','showcase.js','connection.js','family.js','native-bridge.js','storage.js','app.js']
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 def mount(page):
  page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div><div id="print-root"></div></body></html>')
  page.evaluate("""() => {
    const memory = {}; const store = { getItem(k){return memory[k]??null},setItem(k,v){memory[k]=String(v)},removeItem(k){delete memory[k]} };
    Object.defineProperty(window,'localStorage',{configurable:true,value:store});
    Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem(k){return null},setItem(){},removeItem(){}}});
  }""")
  for name in styles: page.add_style_tag(content=(root/name).read_text())
  for name in scripts: page.add_script_tag(content=(root/name).read_text())
  page.wait_for_timeout(450)
 page=browser.new_page(viewport={'width':1365,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 mount(page)
 print('App mounted',page.locator('#app').inner_text()[:180])
 assert page.get_by_text('Your classroom. Your families. One place.').first.is_visible()
 page.screenshot(path=str(root/'assets'/'build11-teacher-desktop.png'),full_page=True)
 page.locator('#invite-form [name=email]').fill('fictional.parent@example.org')
 page.locator('#invite-form button[type=submit]').click()
 page.wait_for_timeout(500)
 assert page.get_by_text('COPY OR SEND THIS INVITE NOW').is_visible()
 print('Invitation generated')
 page.locator('#family-announcement-form textarea').fill('New practice questions are posted in the fictional classroom.')
 page.locator('#family-announcement-form button').click()
 page.wait_for_timeout(350)
 assert page.get_by_text('New practice questions are posted in the fictional classroom.').first.is_visible()
 print('Announcement saved')
 page.locator('#family-homework-form [name=title]').fill('Homework test preview')
 page.locator('#family-homework-form [name=instructions]').fill('Fictional fractions homework instructions.')
 page.locator('#family-homework-form button').click()
 page.wait_for_timeout(350)
 print('Homework saved')
 page.get_by_role('button',name='Parent',exact=True).first.click()
 page.wait_for_timeout(300)
 assert page.get_by_text('Everything for your child in one place.').first.is_visible()
 assert page.get_by_text('Fictional fractions homework instructions.').first.is_visible()
 assert page.get_by_text('New practice questions are posted in the fictional classroom.').first.is_visible()
 page.screenshot(path=str(root/'assets'/'build11-parent-desktop.png'),full_page=True)
 print('Parent preview shows homework and announcement')
 assert not errors, errors
 mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 mobile.on('pageerror',lambda e:errors.append(str(e)))
 mount(mobile)
 assert mobile.get_by_text('Your classroom. Your families. One place.').first.is_visible()
 mobile.screenshot(path=str(root/'assets'/'build11-mobile-teacher.png'),full_page=True)
 print('Mobile preview visible')
 assert not errors, errors
 browser.close()
print('PASS: mounted-browser teacher invitation/announcement/homework and fictional parent/moblie views')
