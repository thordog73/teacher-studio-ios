const CACHE='teacher-studio-static-build12-v1.2.0';
const ASSETS=['./','./index.html','./styles.css','./hub.css','./space.css','./growth.css','./evolution.css','./showcase.css','./connection.css','./family.css','./communication.css','./storage.css','./math.js','./pilot-config.js','./cloud.js','./app.js','./hub.js','./space.js','./growth.js','./evolution.js','./showcase.js','./connection.js','./family.js','./faq-seed.js','./communication-model.js','./communication.js','./storage.js','./native-bridge.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
const ALLOW=new Set(ASSETS.map(a=>new URL(a,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 // Cache only our public code, never student files or authenticated responses.
 const u=new URL(req.url);
 if(!ALLOW.has(u.pathname)||req.headers.has('Authorization'))return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
