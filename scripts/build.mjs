import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as esbuild from 'esbuild';
const root=resolve(process.cwd());
const web=join(root,'web'), dest=join(root,'www');
if (!existsSync(join(web,'index.html'))) throw Error('Missing Teacher Studio Build 11 source');
rmSync(dest,{recursive:true,force:true});
mkdirSync(dest,{recursive:true});
cpSync(web,dest,{recursive:true});
await esbuild.build({entryPoints:[join(root,'scripts','native-bridge.mjs')],
  outfile:join(dest,'native-bridge.js'), bundle:true, format:'iife',
  platform:'browser', target:['safari16'], minify:true});
// Embed only PUBLIC project credentials, not secrets. A blank config keeps an offline fictional-data demo.
const url = process.env.TEACHER_STUDIO_SUPABASE_URL || '';
const key = process.env.TEACHER_STUDIO_SUPABASE_PUBLISHABLE_KEY || '';
if (url || key) {
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key||/sb_secret_|service_role/i.test(key)) throw Error('Provide only the Supabase project URL and its public publishable/anon key.');
 writeFileSync(join(dest,'pilot-config.js'), 'window.TEACHER_STUDIO_CLOUD_CONFIG = '+JSON.stringify({url,key})+';\n');
}
writeFileSync(join(dest,'BUILD_INFO.txt'),'Gloria Esser Teaching Tool Build 11 (1.1.0) Family Connect; fictional student data only\n');
console.log('Gloria Esser Teaching Tool bundled for Capacitor iOS without CDN runtime assets.');
