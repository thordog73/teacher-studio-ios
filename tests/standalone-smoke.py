from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1260,'height':800})
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content('<div></div>')
 page.evaluate('''() => { const f=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});Object.defineProperty(window,'localStorage',{configurable:true,value:f()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:f()});window.print=()=>{};window.confirm=()=>true; }''')
 page.set_content((BASE/'standalone-demo.html').read_text(),wait_until='load')
 assert page.locator('header h1').inner_text()=='Overview'
 page.get_by_role('button',name='School Hub',exact=True).click()
 assert page.locator('.hub-intro').count()==1
 page.get_by_role('button',name='My Classroom Page',exact=True).click()
 assert page.locator('.space-page').count()==1
 assert page.locator('#space-style-form').count()==1
 assert 'Teacher Studio v9.0' in page.locator('body').inner_text()
 page.get_by_role('button',name='My Storage & Backup',exact=True).click()
 assert page.locator('.ts-storage').count()==1
 page.get_by_role('button',name='Standards & Mastery',exact=True).click()
 assert page.locator('.growth-banner').count()==1
 page.get_by_role('button',name='Remember Why',exact=True).click()
 assert page.locator('#growth-profile-form').count()==1
 assert not errs,errs
 print('STANDALONE HTML OK: application, School Hub, classroom personalization and fictional parent controls loaded; no page errors')
 b.close()
