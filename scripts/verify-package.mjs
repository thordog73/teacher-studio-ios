import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFileSync(join(root,name),'utf8');
const index=read('web/index.html');
const app=read('web/app.js');
const storage=read('web/storage.js');
const worker=read('web/sw.js');
const config=JSON.parse(read('capacitor.config.json'));
const pkg=JSON.parse(read('package.json'));
const linked=[...index.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const required=['math.js','pilot-config.js','cloud.js','hub.js','space.js','growth.js','evolution.js','showcase.js','connection.js','family.js','faq-seed.js','communication-model.js','communication.js','native-bridge.js','storage.js','app.js'];
for(const name of required){
 if(!linked.includes(name))throw Error('Missing linked script '+name);
 if(!existsSync(join(root,'web',name)))throw Error('Missing source script '+name);
}
for(const name of linked){
 if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(name))throw Error('Runtime scripts must be bundled locally: '+name);
}
for(const [before,after] of [['family.js','faq-seed.js'],['faq-seed.js','communication-model.js'],['communication-model.js','communication.js'],['communication.js','native-bridge.js'],['storage.js','app.js']]){
 if(linked.indexOf(before)>=linked.indexOf(after))throw Error('Script order must keep '+before+' before '+after);
}
for(const name of ['family.css','communication.css']){
 if(!index.includes('href="'+name+'"')||!existsSync(join(root,'web',name)))throw Error('Missing linked stylesheet '+name);
}
for(const name of ['communication.css','faq-seed.js','communication-model.js','communication.js']){
 if(!worker.includes('./'+name))throw Error('Service worker is missing local asset '+name);
}
if(!/\btoday\s*:/.test(app)||!/\bpage\s*:\s*['"]today['"]/.test(app)||!/TeacherCommunication\??\.render/.test(app))throw Error('Missing Today navigation or Family Desk rendering hook');
if(!app.includes('!STANDALONE'))throw Error('Standalone app must prevent service-worker and connected startup');
if(!storage.includes('TeacherNativeBackup?.available'))throw Error('Missing native backup integration');
if(config.appId!=='com.frontofus.teacherstudio'||config.webDir!=='www')throw Error('Capacitor identity or web directory changed');
if(pkg.version!=='1.2.0'||!app.includes('Build 12'))throw Error('Build 12 displayed/package version mismatch');
if(!existsSync(join(root,'scripts/build-standalone.mjs'))||!pkg.scripts['build:standalone'])throw Error('Missing standalone generator command');
if(!pkg.scripts['test:communication']?.includes('communication-model.test.cjs')||!pkg.scripts['test:communication']?.includes('communication-ui.test.cjs'))throw Error('Missing communication verification commands');
if(!pkg.scripts['test:upload']?.includes('tests/testflight-launcher.test.cjs')||!pkg.scripts.test.includes('test:upload'))throw Error('Missing automatic uploader test command');
const pipeline=read('codemagic.yaml');
for(const name of ['ios-compile-check','ios-testflight','com.frontofus.teacherstudio']){
 if(!pipeline.includes(name))throw Error('Missing preserved Codemagic workflow or identity: '+name);
}
const manifest=read('UPDATE-FILES.txt');
if(manifest.charCodeAt(0)===0xfeff)throw Error('Windows release file list must not contain a byte-order mark');
const releaseFiles=manifest.trimEnd().split(/\r?\n/);
const releaseSet=new Set();
const excludedParts=new Set(['.git','node_modules','www','ios','__pycache__']);
for(const name of releaseFiles){
 if(!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name))throw Error('Unsafe release path: '+name);
 if(name.split('/').some(part=>part==='.'||part==='..'||excludedParts.has(part.toLowerCase())||part.toLowerCase().startsWith('.env')))throw Error('Excluded release path: '+name);
 if(releaseSet.has(name.toLowerCase()))throw Error('Duplicate Windows release path: '+name);
 releaseSet.add(name.toLowerCase());
 if(!existsSync(join(root,name))||!lstatSync(join(root,name)).isFile())throw Error('Release file is missing or is not a regular file: '+name);
}
for(const name of ['UPDATE.cmd','UPDATE-FILES.txt','scripts/start-testflight.cjs','tests/testflight-launcher.test.cjs','README.md','TESTFLIGHT_STEPS_WINDOWS.md','.gitignore','package.json','package-lock.json','capacitor.config.json','codemagic.yaml','web/index.html','web/communication.css',...required.map(name=>'web/'+name)]){
 if(!releaseSet.has(name.toLowerCase()))throw Error('Required file is omitted from the Windows update: '+name);
}
console.log('Packaging checks passed: Build 12 Today, Family Desk assets/order, inherited tools, offline source, native backup bridge, iOS pipeline and '+releaseFiles.length+' Windows update files are wired.');
