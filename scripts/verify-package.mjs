import {readFileSync,existsSync} from 'node:fs';
const a=readFileSync('web/index.html','utf8');
const st=readFileSync('web/storage.js','utf8');
const c=JSON.parse(readFileSync('capacitor.config.json','utf8'));
for(const name of ['math.js','pilot-config.js','cloud.js','hub.js','space.js','growth.js','evolution.js','showcase.js','connection.js','family.js','native-bridge.js','storage.js','app.js']) {
 if(!a.includes('src="'+name+'"')) throw Error('Missing linked script '+name);
 if(name!=='native-bridge.js'&&!existsSync('web/'+name))throw Error('Missing script '+name);
}
if(!st.includes('TeacherNativeBackup?.available'))throw Error('Missing native backup integration');
if(!c.appId || c.webDir!=='www') throw Error('Invalid Capacitor configuration');
if(!existsSync('codemagic.yaml'))throw Error('Missing Codemagic workflow');
if(!a.includes('href="family.css"'))throw Error('Missing family CSS');
console.log('Packaging checks passed: Family Connect assets, offline source and iOS bridge wired.');
