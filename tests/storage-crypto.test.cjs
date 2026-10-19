/* Dependency-free Node integration test for IndexedDB transaction model and real Web Crypto. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {File,Blob}=require('node:buffer');
const storesByDB=new Map();
class MockDB {
 constructor(name){this.name=name;this.stores=storesByDB.get(name)||new Map();storesByDB.set(name,this.stores);this.objectStoreNames={contains:n=>this.stores.has(n)}}
 createObjectStore(name,opt={}){this.stores.set(name,{values:new Map(),keyPath:opt.keyPath});return {}}
 close(){}
 transaction(names,mode){return new MockTransaction(this,names,mode)}
}
class MockTransaction {
 constructor(db,names,mode){this.db=db;this.stores=Array.isArray(names)?names:[names];this.mode=mode;this.pending=0;this.inFlight=false;this.done=false;this.oncomplete=null;this.onerror=null;this.onabort=null;}
 begin(){this.pending++}
 settle(){this.pending--;this.check()}
 check(){if(this.pending!==0||this.inFlight||this.done)return;this.inFlight=true;setImmediate(()=>{this.inFlight=false;if(this.pending===0&&!this.done){this.done=true;this.oncomplete?.()}else this.check()})}
 objectStore(name){if(!this.stores.includes(name))throw Error('Missing store in transaction '+name);const data=this.db.stores.get(name);if(!data)throw Error('Store missing '+name);const tx=this;
  function req(fn){const r={onsuccess:null,onerror:null,result:undefined};tx.begin();setImmediate(()=>{try{r.result=fn();r.onsuccess?.({target:r})}catch(e){r.error=e;r.onerror?.({target:r});tx.onerror?.({target:tx})}finally{tx.settle()}});return r}
  return {
   put(v,key){return req(()=>{data.values.set(key??v[data.keyPath],v);return key??v[data.keyPath]})},
   delete(key){return req(()=>data.values.delete(key))},
   clear(){return req(()=>data.values.clear())},
   get(key){return req(()=>data.values.get(key))},
   getAll(){return req(()=>[...data.values.values()])},
   openCursor(){const r={onsuccess:null,onerror:null,result:undefined};tx.begin();const entries=[...data.values.entries()];let i=0;const tick=()=>setImmediate(()=>{if(i<entries.length){const [key,value]=entries[i++];r.result={key,value,continue:tick};r.onsuccess?.({target:r})}else{r.result=null;r.onsuccess?.({target:r});tx.settle()}});tick();return r}
  }
 }
 abort(){this.done=true;this.onabort?.()}
}
const indexedDB={open(name){const r={onsuccess:null,onerror:null,onupgradeneeded:null,result:null};setImmediate(()=>{try{let newDB=!storesByDB.has(name);r.result=new MockDB(name);if(newDB)r.onupgradeneeded?.({target:r});r.onsuccess?.({target:r})}catch(e){r.error=e;r.onerror?.({target:r})}});return r}};
const values=new Map();const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
globalThis.window=globalThis;globalThis.crypto=webcrypto;globalThis.File=File;globalThis.Blob=Blob;globalThis.indexedDB=indexedDB;globalThis.localStorage=localStorage;
globalThis.document={addEventListener(){},getElementById(){return null}};
globalThis.navigator={storage:{estimate:async()=>({usage:12345,quota:1024**3}),persisted:async()=>false,persist:async()=>true}};
globalThis.confirm=()=>true;globalThis.alert=()=>{};globalThis.window.teacherStudioRender=()=>{};
vm.runInThisContext(fs.readFileSync(path.resolve(__dirname,'../web/storage.js'),'utf8'),{filename:'storage.js'});
(async()=>{
 const mod=globalThis.TeacherStorage;
 assert.ok(mod);
 const teacherFile=new File([new TextEncoder().encode('Personal lesson: model fractions on the number line.')],'original-fractions.txt',{type:'text/plain'});
 const second=new File([new Uint8Array(1024*1024).map((_,i)=>i%251)],'teaching-photo.bin',{type:'application/octet-stream'});
 assert.equal(await mod.addPersonalFiles([teacherFile,second],'Lesson plans','Teacher original','personal'),2);
 assert.equal((await mod.listItems()).length,2);
 localStorage.setItem('teacherstudio_evolution_v5',JSON.stringify({classes:{'demo-class':{kits:[{label:'Saved teacher lesson'}],checks:[{correct:false}]}}}));
 localStorage.setItem('teacherstudio_growth_v4',JSON.stringify({classes:{'demo-class':{profile:{why:'To inspire'},attempts:[{score:1,studentId:'fictional'}],moments:[],remixes:[]}}}));
 localStorage.setItem('teacherstudio_demo_v1',JSON.stringify({students:[{id:'fake-student',name:'NOT IN BACKUP'}],results:[{score:3}]}));
 const pass='Original-teacher-backup-2026';
 const {blob,manifest}=await mod.createBackup(pass,true);
 assert.equal(manifest.files.length,2);
 assert.equal(manifest.drafts.teacherstudio_evolution_v5.classes['demo-class'].checks.length,0);
 assert.equal(manifest.drafts.teacherstudio_growth_v4.classes['demo-class'].attempts.length,0);
 assert.ok(manifest.excluded.includes('student rosters'));
 assert.ok(blob.size>teacherFile.size+second.size);
 const buf=Buffer.from(await blob.arrayBuffer());
 assert.equal(buf.subarray(0,9).toString(),'TSBACKUP8');
 assert.ok(!buf.includes('original-fractions.txt'));
 assert.ok(!buf.includes('NOT IN BACKUP'));
 const encryptedBackup=new File([blob],'backup.tsbackup');
 const verified=await mod.verifyBackup(encryptedBackup,pass);
 assert.equal(verified.files,2);
 const parsed=await mod.parseBackup(encryptedBackup,pass);
 assert.equal(parsed.manifest.files.length,2);
 let wrong=false;try{await mod.parseBackup(encryptedBackup,'wrong-password')}catch(e){wrong=/Incorrect passphrase/.test(e.message)}assert.ok(wrong,'wrong password must be rejected');
 const tampered=Uint8Array.from(buf);tampered[tampered.length-3]^=37;
 // parseBackup authenticates metadata; encrypted chunks are fully verified before replacing live records.
 const before=await mod.listItems();let failed=false;
 try{await mod.loadRestoration(new File([tampered],'tampered.tsbackup'),pass)}catch(e){failed=/authentication failed/.test(e.message)}
 assert.ok(failed,'corrupted final chunk must be rejected');
 let badVerify=false;try{await mod.verifyBackup(new File([tampered],'tampered.tsbackup'),pass)}catch(e){badVerify=/verification failed/.test(e.message)}
 assert.ok(badVerify,'read-only verification detects tampered file content');
 assert.equal((await mod.listItems()).length,before.length,'failed restore must not change the library');
 // Delete a file, then restore the authenticated backup.
 const db=await mod.dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction('items','readwrite');tx.objectStore('items').delete(before[0].id);tx.oncomplete=resolve;tx.onerror=reject});db.close();
 assert.equal((await mod.listItems()).length,1);
 const restore=await mod.loadRestoration(encryptedBackup,pass);
 assert.equal(restore.files,2);
 const after=await mod.listItems();assert.equal(after.length,2);
 assert.ok(after.some(x=>x.name==='original-fractions.txt'));
 const text=await after.find(x=>x.name==='original-fractions.txt').blob.text();assert.ok(text.includes('Personal lesson'));
 assert.equal(JSON.parse(localStorage.getItem('teacherstudio_growth_v4')).classes['demo-class'].profile.why,'To inspire');
 assert.equal(JSON.parse(localStorage.getItem('teacherstudio_growth_v4')).classes['demo-class'].attempts.length,0);
 assert.ok(localStorage.getItem('teacherstudio_demo_v1').includes('NOT IN BACKUP'),'gradebook not overwritten');
 assert.ok(mod.render({mode:'demo',role:'teacher',classId:'demo-class'}).includes('My Classroom Storage & Backup'));
 assert.ok(mod.backupState().needsBackup, 'Without an off-device copy teacher is reminded');
 assert.ok(mod.render({mode:'demo',role:'parent'}).includes('private'));
 console.log('PASS: REAL AES-GCM/PBKDF2 backup, authentication, two files/1 MB chunking, tamper rejection, zero side effects on failed restore, verified restored bytes, student data exclusion, teacher draft retention');
})().catch(e=>{console.error(e);process.exitCode=1});
