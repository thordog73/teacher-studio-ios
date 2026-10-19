#!/usr/bin/env python3
"""Preflight validation for the Gloria Esser Teaching Tool TestFlight source.

Runs with Python's standard library, before npm or CocoaPods dependencies exist.
Does not assert that Xcode code signing, Supabase authorization, or live iOS builds work.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

root=Path(__file__).resolve().parent.parent
p=json.loads((root/'package.json').read_text())
cap=json.loads((root/'capacitor.config.json').read_text())
yaml=(root/'codemagic.yaml').read_text()
errors=[]
required=('web/index.html','scripts/build.mjs','scripts/native-bridge.mjs',
          'ios-support/AppIcon-1024.png','ios-support/PrivacyInfo.xcprivacy',
          'supabase/schema.sql','TESTFLIGHT_STEPS_WINDOWS.md','codemagic.yaml')
for file in required:
    if not (root/file).is_file(): errors.append('Missing: '+file)
if p.get('name')!='gloria-esser-teaching-tool': errors.append('Wrong package name')
if cap.get('appName')!='Gloria Esser Teaching Tool': errors.append('Wrong public app name')
if cap.get('appId') != 'com.frontofus.teacherstudio':
    errors.append('Bundle identifier changed: update Codemagic signing to match')
if not re.search(r'(?m)^\s*bundle_identifier:\s*'+re.escape(cap.get('appId',''))+r'\s*(?:#.*)?$', yaml):
    errors.append('Codemagic signing bundle ID differs from capacitor.config.json')
for entry in ('ios-compile-check:', 'ios-testflight:', 'ios_signing:', 'submit_to_testflight: true',
              'npx cap add ios --packagemanager CocoaPods', 'xcode-project build-ipa',
              'python3 scripts/prepare_ios.py'):
    if entry not in yaml: errors.append('Codemagic configuration missing '+entry)
for name in ('web/pilot-config.js','web/native-bridge.js'):
    if not (root/name).is_file(): errors.append('Missing web asset '+name)
if re.search(r'sb_secret_|service_role', (root/'web/pilot-config.js').read_text(), re.I):
    errors.append('The default cloud pilot configuration contains a secret-key indicator')
try:
    from PIL import Image
    img=Image.open(root/'ios-support/AppIcon-1024.png')
    if img.size!=(1024,1024): errors.append('App icon is not 1024x1024')
except ImportError:
    pass # Pillow is optional: image dimensions validated with stdlib PNG header below.
except Exception as e:
    errors.append('Could not inspect icon: '+str(e))
try:
    import struct
    im=(root/'ios-support/AppIcon-1024.png').read_bytes()
    if im[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',im[16:24])!=(1024,1024):
        errors.append('App icon is not a 1024x1024 PNG')
except Exception as e: errors.append('Icon header failed validation: '+str(e))
try:
    ET.parse(root/'ios-support/PrivacyInfo.xcprivacy')
except Exception as e: errors.append('Invalid privacy manifest XML: '+str(e))
for file in (root/'scripts'/'prepare_ios.py',root/'scripts'/'attach_privacy.rb'):
    if 'package.json' not in file.read_text(): errors.append('Version is not read from package.json in '+file.name)
if not (root/'.gitignore').is_file() or 'node_modules/' not in (root/'.gitignore').read_text():
    errors.append('Missing .gitignore protections')
if '--check-xcode' in sys.argv:
    try:
        v=subprocess.check_output(['xcodebuild','-version'],text=True)
        m=re.search(r'Xcode\s+(\d+)',v)
        if not m or int(m.group(1))<26: errors.append('Capacitor 8 requires Xcode 26 or higher')
    except Exception as e: errors.append('Unable to run xcodebuild: '+str(e))
if errors:
    print('PRECHECK FAILED:')
    for item in errors: print(' -',item)
    sys.exit(1)
print('PRECHECK PASSED: app name, bundle ID, CocoaPods workflow, artifacts, version sources, and privacy XML.')
