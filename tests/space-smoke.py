from pathlib import Path
import subprocess, time, os
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parent.parent
port=18775
pserver=subprocess.Popen(['python','-m','http.server',str(port),'--bind','127.0.0.1'], cwd=str(BASE), stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
  time.sleep(.5)
  with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1470,'height':930},accept_downloads=True)
    page=ctx.new_page();errs=[]
    page.on('pageerror',lambda err:errs.append(str(err)))
    page.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
    page.evaluate("""() => {
      const store=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});
      Object.defineProperty(window,'localStorage',{configurable:true,value:store()});
      Object.defineProperty(window,'sessionStorage',{configurable:true,value:store()});
      window.confirm=()=>true;
      window.print=()=>{};
      const records=new Map();
      Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){
        const db={objectStoreNames:{contains:()=>true},createObjectStore:()=>{},close:()=>{},transaction(){const tx={oncomplete:null,onerror:null,objectStore(){return {
          put(blob,id){records.set(id,blob); queueMicrotask(()=>tx.oncomplete?.());},
          get(id){const r={onsuccess:null,onerror:null,result:null};queueMicrotask(()=>{r.result=records.get(id)||null;r.onsuccess?.()});return r;}
        }}};return tx;}};
        const request={result:db,onsuccess:null,onerror:null,onupgradeneeded:null};queueMicrotask(()=>request.onsuccess?.());return request;
      }}});
    }""")
    for css in ['styles.css','hub.css','space.css']:page.add_style_tag(content=(BASE/css).read_text())
    for js in ['math.js','cloud.js','hub.js','space.js','app.js']:page.add_script_tag(content=(BASE/js).read_text())
    page.get_by_role('button',name='My Classroom Page',exact=True).click()
    assert page.locator('h2').filter(has_text='Room 204').count()>0
    page.locator('#space-style-form input[name=roomTitle]').fill('The Discovery Den')
    page.locator('#space-style-form input[name=teacherName]').fill('Ms. Demo')
    page.locator('.space-swatch').filter(has_text='Lavender').click()
    page.locator('#space-style-form button[type=submit]').click()
    assert 'The Discovery Den' in page.locator('.space-banner h2').inner_text()
    page.locator('#space-event-form input[name=title]').fill('Imaginary classroom art fair')
    page.locator('#space-event-form input[name=date]').fill('2026-11-04')
    page.locator('#space-event-form button[type=submit]').click()
    assert 'Imaginary classroom art fair' in page.locator('.space-grid').inner_text()
    page.locator('#space-link-form input[name=title]').fill('NASA for Kids')
    page.locator('#space-link-form input[name=url]').fill('https://www.nasa.gov/learning-resources/')
    page.locator('#space-link-form button[type=submit]').click()
    assert page.locator('.space-link a').count()==2
    # Use the fictional homework image as a generic drawing. Teacher-only by default.
    page.locator('#space-art-form input[name=title]').fill('Teacher-only sample drawing')
    page.locator('#space-art-form input[name=image]').set_input_files(str(BASE/'tests/fictional-homework.png'))
    page.locator('#space-art-form button[type=submit]').click()
    page.locator('.space-piece').first.wait_for(timeout=5000)
    assert page.locator('.space-piece').count()==1
    assert 'Teacher-only sample drawing' in page.locator('.space-piece').inner_text()
    page.wait_for_function("() => !!document.querySelector('.space-art-image')?.getAttribute('src')")
    # Add family-visible fictional art.
    page.locator('#space-art-form input[name=title]').fill('Family-visible sample art')
    page.locator('#space-art-form input[name=image]').set_input_files(str(BASE/'tests/fictional-homework.png'))
    page.locator('#space-art-form select[name=audience]').select_option('class')
    page.locator('#space-art-form input[name=rights]').check()
    page.locator('#space-art-form button[type=submit]').click()
    page.wait_for_function("() => document.querySelectorAll('.space-piece').length===2")
    assert page.locator('.space-piece').count()==2
    # Preview must filter private content before publishing.
    page.get_by_role('button',name='Preview as family').click()
    assert page.locator('.space-piece').count()==1
    assert page.get_by_text('Family-visible sample art').count()>0
    assert page.get_by_text('Teacher-only sample drawing').count()==0
    page.get_by_role('button',name='Back to editing').click()
    # Toggle links section in draft; verify change.
    page.locator('section[data-space-section=links] input[data-space=visibility]').uncheck()
    assert page.locator('section[data-space-section=links]').count()==1 # preview retains editor section
    page.get_by_role('button',name='Preview as family').click()
    assert page.locator('section[data-space-section=links]').count()==0
    page.get_by_role('button',name='Back to editing').click()
    page.get_by_role('button',name='Publish to demo family view').click()
    page.screenshot(path=str(BASE/'assets/classroom-page-preview.png'),full_page=True)
    page.get_by_role('button',name='Parent',exact=True).click()
    page.get_by_role('button',name='My Classroom Page',exact=True).click()
    assert 'The Discovery Den' in page.locator('.space-banner h2').inner_text()
    assert page.locator('.space-piece').count()==1
    assert page.get_by_text('Teacher-only sample drawing').count()==0
    assert page.locator('section[data-space-section=links]').count()==0
    assert 'The Discovery Den' in page.evaluate("localStorage.getItem('teacherstudio_space_v3_demo-class')")
    # Switch back to teacher, make a second classroom then ensure isolation.
    page.get_by_role('button',name='Teacher',exact=True).click()
    page.get_by_role('button',name='Roster & access',exact=True).click()
    page.locator('#class-form input[name=name]').fill('Period 2 · Different Classroom')
    page.locator('#class-form button[type=submit]').click()
    page.get_by_role('button',name='My Classroom Page',exact=True).click()
    assert 'Period 2 · Different Classroom' in page.locator('.space-banner h2').inner_text()
    assert page.locator('.space-piece').count()==0
    page.locator('.space-current-class select').select_option('demo-class')
    assert 'The Discovery Den' in page.locator('.space-banner h2').inner_text()
    assert not errs,errs
    # Parent should not be able to see unlinked teacher's second classroom.
    page.locator('.space-current-class select').select_option('demo-class')
    page.get_by_role('button',name='Parent',exact=True).click()
    page.get_by_role('button',name='My Classroom Page',exact=True).click()
    assert page.locator('.space-current-class select option').count()==0
    # mobile render
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(BASE/'assets/classroom-page-mobile.png'),full_page=True)
    print('CLASSROOM SPACE SMOKE PASSED: theme, events, links, uploads, privacy, publishing, persistence, classroom isolation, and mobile')
    print('ERRORS',errs)
    b.close()
finally:
  pserver.terminate(); pserver.wait()
