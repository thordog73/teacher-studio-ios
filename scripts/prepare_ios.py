#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, plistlib, shutil, os
base=Path('ios/App/App')
info=base/'Info.plist'
if not info.exists(): raise SystemExit('Missing generated Capacitor iOS project.')
# plistlib conversion to binary overwrites formatting but Xcode supports binary property lists.
with info.open('rb') as f: obj=plistlib.load(f)
obj['CFBundleDisplayName']='Gloria Esser'
obj['NSCameraUsageDescription']='Capture a worksheet or classroom teaching material you choose to add.'
obj['NSPhotoLibraryUsageDescription']='Choose teaching-related images or artwork from your photo library.'
obj['UIFileSharingEnabled']=True
obj['LSSupportsOpeningDocumentsInPlace']=True
obj['CFBundleShortVersionString']=json.loads(Path('package.json').read_text())['version']
obj['CFBundleVersion']=str(os.environ.get('PROJECT_BUILD_NUMBER','1'))
with info.open('wb') as f: plistlib.dump(obj,f,fmt=plistlib.FMT_XML)
# App icon sets may differ; create each size named in the generated asset catalog.
icons=base/'Assets.xcassets'/'AppIcon.appiconset'
if not icons.exists(): raise SystemExit('Missing Xcode AppIcon asset catalog')
contents=icons/'Contents.json'
data=json.loads(contents.read_text())
source=Path('ios-support/AppIcon-1024.png').resolve()
for ent in data.get('images',[]):
    filename=ent.get('filename')
    if not filename: continue
    size=float(ent.get('size','1024x1024').split('x')[0]); scale=float(ent.get('scale','1x').rstrip('x'))
    px=int(size*scale)
    # Single-size catalogs use 1024x1024 iOS marketing icon.
    subprocess.check_call(['sips','-s','format','png','-z',str(px),str(px),str(source),'--out',str(icons/filename)],stdout=subprocess.DEVNULL)
shutil.copyfile('ios-support/PrivacyInfo.xcprivacy',base/'PrivacyInfo.xcprivacy')
print('iOS properties, icons and privacy manifest created. Confirm App Store privacy disclosures manually.')
