import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const web=join(root,'web'), dest=join(root,'www');
const {version}=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
for(const name of ['index.html','communication.css','communication-model.js','faq-seed.js','communication.js']) {
 if(!existsSync(join(web,name))) throw Error('Missing Teacher Studio Build 12 source: '+name);
}
// Embed only PUBLIC project credentials, not secrets. A blank config keeps an offline fictional-data demo.
const url = process.env.TEACHER_STUDIO_SUPABASE_URL || '';
const key = process.env.TEACHER_STUDIO_SUPABASE_PUBLISHABLE_KEY || '';
if (url || key) {
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key||/sb_secret_|service_role/i.test(key)) throw Error('Provide only the Supabase project URL and its public publishable/anon key.');
}
rmSync(dest,{recursive:true,force:true});
mkdirSync(dest,{recursive:true});
cpSync(web,dest,{recursive:true});
await esbuild.build({entryPoints:[join(root,'scripts','native-bridge.mjs')],
  outfile:join(dest,'native-bridge.js'), bundle:true, format:'iife',
  platform:'browser', target:['safari16'], minify:true});
if (url || key) {
 writeFileSync(join(dest,'pilot-config.js'), 'window.TEACHER_STUDIO_CLOUD_CONFIG = '+JSON.stringify({url,key})+';\n');
}
writeFileSync(join(dest,'BUILD_INFO.txt'),`Teacher Studio Build 12 (${version}) Family Desk\nLocal fictional practice; optional existing Family Connect pilot requires configuration.\nNew operational requests are not remotely delivered or approved.\n`);
console.log('Teacher Studio bundled for Capacitor iOS without CDN runtime assets.');
