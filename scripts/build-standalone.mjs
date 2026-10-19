import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const web=resolve(root,'web');
const {version}=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const output=resolve(root,'standalone-demo.html');
let html=readFileSync(resolve(web,'index.html'),'utf8');
const scripts=[];
const styles=[];
const getAttribute=(tag,name)=>tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\\\'])(.*?)\\1','i'))?.[2];
const mimeTypes={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon'};

function localPath(reference,from=web){
 if(!reference||/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(reference)) throw Error('Standalone assets must be local: '+reference);
 const path=resolve(from,decodeURIComponent(reference.split(/[?#]/,1)[0]));
 const rel=relative(web,path);
 if(rel==='..'||rel.startsWith('..'+sep)||!existsSync(path)) throw Error('Missing or outside-source asset: '+reference);
 return path;
}
function dataURI(path){return 'data:'+(mimeTypes[extname(path).toLowerCase()]||'application/octet-stream')+';base64,'+readFileSync(path).toString('base64');}
function inlineCSS(path){
 const css=readFileSync(path,'utf8');
 if(/@import\b/i.test(css)) throw Error('Inline CSS imports in the source before building the standalone demo: '+path);
 return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(match,quote,url)=>{
  const value=url.trim();
  if(/^(?:data:|#)/i.test(value)) return match;
  return 'url("'+dataURI(localPath(value,dirname(path)))+'")';
 }).replace(/<\/style/gi,'<\\/style');
}

// Keep the exact stylesheet order from index.html. The single file has no manifest
// or worker; its icon and any local CSS images/fonts are embedded as data URLs.
html=html.replace(/<link\b[^>]*>/gi,tag=>{
 const rel=(getAttribute(tag,'rel')||'').toLowerCase();
 const href=getAttribute(tag,'href');
 if(rel==='manifest')return '';
 if(rel==='stylesheet'){
  styles.push(href);
  return '<style data-teacher-source="'+href+'">\n'+inlineCSS(localPath(href))+'\n</style>';
 }
 if(rel==='icon'||rel==='shortcut icon')return '<link rel="icon" href="'+dataURI(localPath(href))+'">';
 throw Error('Review unsupported standalone link element: '+tag);
});

// Deferred classic scripts execute after the DOM in the multi-file app. Move the
// same ordered scripts to the end of the body so inline execution keeps that rule.
html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,(tag,attributes,inline)=>{
 if(/\basync\b/i.test(attributes)||/\btype\s*=\s*["']module["']/i.test(attributes))throw Error('Standalone builder expects ordered classic scripts.');
 const src=getAttribute(attributes,'src');
 let code=src?readFileSync(localPath(src),'utf8'):inline;
 // Standalone previews never embed project configuration, even if the source
// package was prepared for the separately configured connected pilot.
 if(src==='pilot-config.js')code='window.TEACHER_STUDIO_CLOUD_CONFIG={};';
 scripts.push({name:src||'inline',code});
 return '';
});
for(const name of ['communication-model.js','faq-seed.js','communication.js','native-bridge.js','app.js']){
 if(!scripts.some(s=>s.name===name))throw Error('Standalone source is missing '+name);
}
if(!styles.includes('communication.css'))throw Error('Standalone source is missing communication.css');
const bridge=scripts.find(s=>s.name==='native-bridge.js').code;
if(!/available\s*:\s*false/.test(bridge))throw Error('The standalone demo must use the browser native-sharing stub from web/.');
const bootstrap='<script>window.TEACHER_STANDALONE_DEMO=true;window.TEACHER_STUDIO_CLOUD_CONFIG={};</script>';
const bundled=scripts.map(s=>'<script data-teacher-source="'+s.name+'">\n/* '+s.name+' */\n'+s.code.replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n');
if(!/<\/body\s*>/i.test(html))throw Error('Source index.html has no closing body.');
html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>Teacher Studio Build 12 · Family Desk (offline practice)</title>');
html=html.replace(/<meta\s+name=["']description["'][^>]*>/i,'<meta name="description" content="Teacher Studio Build 12 ('+version+') — fictional Family Desk practice and preserved offline teacher tools.">');
html=html.replace(/<\/body\s*>/i,()=>bootstrap+'\n'+bundled+'\n</body>');
if(/<script\b[^>]*\bsrc\s*=/i.test(html)||/<link\b[^>]*\brel=["'](?:stylesheet|manifest)["']/i.test(html))throw Error('Standalone output still contains a linked runtime asset.');
writeFileSync(output,html);
console.log(`Built standalone-demo.html: ${styles.length} inline stylesheets, ${scripts.length} ordered scripts; ${Buffer.byteLength(html).toLocaleString()} bytes. No CDN runtime assets.`);
