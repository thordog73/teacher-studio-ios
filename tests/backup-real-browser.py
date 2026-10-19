"""Build 9 full browser workflow using local HTTP origin and real Web Crypto / IndexedDB."""
from pathlib import Path
import subprocess, time, os, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
PORT=18779
server=subprocess.Popen(['python','-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=str(ROOT),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    time.sleep(.8)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1280,'height':850},accept_downloads=True)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:d.accept())
        page.goto(f'http://127.0.0.1:{PORT}/index.html',wait_until='networkidle')
        page.get_by_role('button',name='My Storage & Backup',exact=True).click()
        assert 'No off-device backup confirmed' in page.locator('.st-safety').inner_text()
        # Upload a teacher's own file.
        page.locator('#storage-files').set_input_files({'name':'my-lesson.txt','mimeType':'text/plain','buffer':b'Original fractions lesson: visualize numerator and denominator.'})
        page.locator('#storage-upload-form input[name=rights]').check()
        page.locator('#storage-upload-form button[type=submit]').click()
        page.get_by_text('my-lesson.txt',exact=True).first.wait_for(timeout=12000)
        page.locator('#storage-backup-form input[name=pass]').fill('Backup-Original-Teaching-2026')
        page.locator('#storage-backup-form input[name=confirmPass]').fill('Backup-Original-Teaching-2026')
        page.locator('#storage-backup-form input[name=reviewed]').check()
        page.locator('#storage-backup-form button[type=submit]').click()
        page.get_by_role('button',name='Download encrypted file').wait_for(timeout=30000)
        assert page.get_by_role('button',name='Download encrypted file').is_enabled()
        with page.expect_download(timeout=30000) as wait:
            page.get_by_role('button',name='Download encrypted file').click()
        d=wait.value
        path='/mnt/data/teacher-studio-v9/tests/real-browser-test.tsbackup'
        d.save_as(path)
        assert Path(path).stat().st_size > 200
        # Verify full archive non-destructively.
        page.locator('#storage-verify-form input[name=backup]').set_input_files(path)
        page.locator('#storage-verify-form input[name=pass]').fill('Backup-Original-Teaching-2026')
        page.locator('#storage-verify-form button[type=submit]').click()
        page.get_by_text('Verification successful:',exact=False).first.wait_for(timeout=30000)
        assert page.get_by_text('No off-device backup confirmed',exact=False).count()==1
        # Teacher saves the external copy and explicitly confirms it.
        page.get_by_role('button',name='I saved my backup elsewhere').click()
        page.wait_for_timeout(350)
        assert page.get_by_text('Backup copy reported saved',exact=False).count()==1
        # Visit another page and return to ensure the self-confirmed state survives rendering.
        page.get_by_role('button',name='Overview',exact=True).click()
        page.get_by_role('button',name='My Storage & Backup',exact=True).click()
        assert page.get_by_text('Backup copy reported saved',exact=False).count()==1
        # Adding a file after a confirmation makes the saved version stale.
        page.locator('#storage-files').set_input_files({'name':'updated-lesson.txt','mimeType':'text/plain','buffer':b'New original teacher lesson.'})
        page.locator('#storage-upload-form input[name=rights]').check()
        page.locator('#storage-upload-form button[type=submit]').click()
        page.get_by_text('updated-lesson.txt',exact=True).first.wait_for(timeout=10000)
        assert 'Your library has changed since that backup' in page.locator('.st-safety').inner_text()
        assert not errors,errors
        page.screenshot(path=str(ROOT/'assets/build9-backup-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT/'assets/build9-backup-mobile.png'),full_page=True)
        print('PASS real-browser: IndexedDB save, AES-GCM backup, download, full verification, self-confirmed remote copy, status retention, change-based reminder, no JS errors')
        browser.close()
finally:
    server.terminate()
    try:server.wait(timeout=4)
    except:server.kill()
