"""Build 4 end-to-end smoke test using fictional browser data only."""
from pathlib import Path
import re
from fractions import Fraction
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
if True:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':950},accept_downloads=True)
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content('<div id="app"></div><div id="toast"></div><div id="print-root"></div>')
        page.evaluate('''() => { const f=()=>({s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}});Object.defineProperty(window,'localStorage',{configurable:true,value:f()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:f()});window.print=()=>{};window.confirm=()=>true; }''')
        for css in ['styles.css','hub.css','space.css','growth.css']:page.add_style_tag(content=(ROOT/css).read_text())
        for js in ['math.js','cloud.js','hub.js','space.js','growth.js','app.js']:page.add_script_tag(content=(ROOT/js).read_text())
        assert page.locator('header h1').inner_text()=='Overview'
        assert 'remember why you teach' in page.locator('.brand').inner_text().lower()
        page.get_by_role('button',name='Standards & Mastery',exact=True).click()
        assert page.get_by_role('heading',name='Standards & Mastery Center').count()==1
        page.locator('#growth-skill').select_option('add')
        page.locator('#growth-level').select_option('standard')
        page.get_by_role('button',name='1 · Start diagnostic').click()
        inputs=page.locator('#growth-answers-form input')
        assert inputs.count()==8
        for i in range(8):
            prompt=page.locator('.growth-question label').nth(i).inner_text().split('. ',1)[-1]
            match=re.search(r'(\d+)/(\d+)\s*\+\s*(\d+)/(\d+)',prompt)
            assert match,repr(prompt)
            a,b,c,d=map(int,match.groups())
            answer=Fraction(a,b)+Fraction(c,d)
            inputs.nth(i).fill(str(answer.numerator) if answer.denominator==1 else str(answer.numerator)+'/'+str(answer.denominator))
        page.get_by_role('button',name='Check all answers').click()
        assert page.locator('.growth-score').inner_text()=='8/8'
        assert page.locator('.growth-result.right').count()==8
        page.get_by_role('button',name='Try a fresh retest').click()
        assert page.locator('#growth-answers-form input').count()==8
        for i in range(8):page.locator('#growth-answers-form input').nth(i).fill('0')
        page.get_by_role('button',name='Check all answers').click()
        assert page.locator('.growth-score').inner_text()=='0/8'
        assert 'Difference: -100 percentage points' in page.locator('main').inner_text()
        stored=page.evaluate("JSON.parse(localStorage.getItem('teacherstudio_growth_v4'))")
        assert len(stored['classes']['demo-class']['attempts'])==2
        page.screenshot(path=str(ROOT/'assets/mastery-v4-preview.png'),full_page=False)
        # Direct navigation via app page and lesson bridge into existing Exchange.
        page.get_by_role('button',name='Teach It Better',exact=True).click()
        assert page.locator('.growth-template').count()==5
        page.get_by_role('button',name='Use this approach').nth(1).click()
        page.locator('#growth-remix-form input[name=title]').fill('My original fraction misconception lesson')
        page.locator('#growth-remix-form textarea[name=notes]').fill('Use a mock sample, no named student data.')
        page.locator('#growth-remix-form button[type=submit]').click()
        assert 'Saved your remixed lesson locally' in page.locator('main').inner_text()
        page.get_by_role('button',name='Copy to Lesson Exchange').click()
        page.get_by_role('button',name='Lesson Exchange',exact=True).click()
        assert 'My original fraction misconception lesson' in page.locator('main').inner_text()
        page.get_by_role('button',name='Teach It Better',exact=True).click()
        page.screenshot(path=str(ROOT/'assets/remix-v4-preview.png'),full_page=False)
        # A private teaching narrative and wall entry.
        page.get_by_role('button',name='Remember Why',exact=True).click()
        page.locator('#growth-profile-form textarea[name=why]').fill('I teach because I love helping children become confident problem solvers.')
        page.locator('#growth-profile-form textarea[name=philosophy]').fill('Use visual models and student explanations before algorithms.')
        page.locator('#growth-profile-form button[type=submit]').click()
        page.locator('#growth-memory-form input[name=title]').fill('Our fictional classroom fraction wall')
        page.locator('#growth-memory-form textarea[name=body]').fill('An imaginary class created a clever visual analogy about halves and thirds.')
        page.locator('#growth-memory-form input[name=privacy]').check()
        page.locator('#growth-memory-form button[type=submit]').click()
        assert page.locator('.growth-moment').count()==1
        page.screenshot(path=str(ROOT/'assets/legacy-v4-preview.png'),full_page=False)
        # New classroom has its own independent profile and no memory.
        page.get_by_role('button',name='Roster & access',exact=True).click()
        page.locator('#class-form input[name=name]').fill('Period 7 · Fictional classroom')
        page.locator('#class-form button[type=submit]').click()
        page.get_by_role('button',name='Remember Why',exact=True).click()
        assert page.locator('.growth-moment').count()==0
        assert page.locator('#growth-profile-form textarea[name=why]').input_value()==''
        # Parent interface excludes growth tools altogether.
        page.get_by_role('button',name='Parent',exact=True).click()
        assert page.get_by_role('button',name='Remember Why',exact=True).count()==0
        assert page.get_by_role('button',name='Standards & Mastery',exact=True).count()==0
        # Mobile layout and no horizontal overflow on original fictional class.
        page.get_by_role('button',name='Teacher',exact=True).click()
        page.get_by_role('button',name='Standards & Mastery',exact=True).click()
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT/'assets/mobile-v4-preview.png'),full_page=False)
        size=page.evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})')
        assert size['scroll']<=size['client']+2,size
        assert errors==[],errors
        print('BUILD 4 GROWTH SMOKE PASSED: fresh diagnostic/retest, actual math grading, private memories, original lessons, Lesson Exchange bridge, classroom isolation, guardian restriction and mobile.')
        browser.close()

