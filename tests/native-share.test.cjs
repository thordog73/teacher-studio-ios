const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('scripts/native-bridge.mjs','utf8')
 .replace("import { Capacitor } from '@capacitor/core';", '')
 .replace("import { Filesystem, Directory } from '@capacitor/filesystem';", '')
 .replace("import { Share } from '@capacitor/share';", '');
const data=[];let wrote=false,shared=false;
const ctx={window:{},Blob,Uint8Array,btoa,Error,
 Capacitor:{isNativePlatform:()=>true},Directory:{Documents:'DOCUMENTS'},
 Filesystem:{
   async writeFile({path,data:x,directory}){assert.match(path,/TeacherStudioBackups\/.+\.tsbackup$/);assert.equal(x,'');assert.equal(directory,'DOCUMENTS');wrote=true;},
   async appendFile({data:x}){data.push(Buffer.from(x,'base64'));},
   async getUri(){return {uri:'file:///private/teacher-studio.tsbackup'}}
 },
 Share:{async share(opts){assert.equal(opts.files[0],'file:///private/teacher-studio.tsbackup');shared=true;}}
};
vm.runInNewContext(src,ctx,{filename:'native-bridge.mjs'});
(async()=>{
 const bytes=Uint8Array.from({length:800001},(_,i)=>i%251);
 const result=await ctx.window.TeacherNativeBackup.share('personal.tsbackup',new Blob([bytes]));
 assert.equal(result.savedOutsideDevice,false);
 assert.equal(Buffer.concat(data).compare(Buffer.from(bytes)),0);
 assert.ok(wrote&&shared);assert.ok(data.length>1,'chunked write expected');
 await assert.rejects(ctx.window.TeacherNativeBackup.share('secret.txt',new Blob([bytes])),/backup/i);
 console.log('PASS: native bridge streams exact encrypted-file bytes in chunks and invokes OS share sheet.');
})().catch(e=>{console.error(e);process.exitCode=1;});
