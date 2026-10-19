const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const logs=[];
const fakeFetch=async(url,options)=>{logs.push({url,options});return {ok:true,status:200,text:async()=>{
 if(url.endsWith('/auth/v1/verify'))return JSON.stringify({access_token:'test-jwt',refresh_token:'test-refresh',expires_at:4102444800,user:{id:'user-1',email:'parent@example.org'}});
 if(url.endsWith('/rest/v1/classrooms?select=*'))return JSON.stringify([{id:'class-1'}]);
 if(url.endsWith('/rest/v1/students?select=*'))return JSON.stringify([{id:'student-1'}]);
 if(url.includes('/rest/v1/assignments'))return JSON.stringify([{id:'assignment-1'}]);
 if(url.includes('/storage/'))return JSON.stringify({Key:'path'});
 return JSON.stringify({});
 }};};
const context={window:{},fetch:fakeFetch,Blob,ArrayBuffer,console,Error,JSON};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'..','web','cloud.js'),'utf8'),context);
const API=context.window.TeacherCloud;
(async()=>{
 assert.throws(()=>new API('http://evil.test','wrong'));
 const api=new API('https://demo.supabase.co','sb_publishable_test');
 await api.sendOtp('parent@example.org');
 assert.equal(logs[0].url,'https://demo.supabase.co/auth/v1/otp');
 assert.equal(JSON.parse(logs[0].options.body).email,'parent@example.org');
 await api.verifyOtp('parent@example.org','123456');
 assert.equal(api.session.access_token,'test-jwt');
 const students=await api.table('students','?select=*');assert.equal(students[0].id,'student-1');
 assert.equal(logs.at(-1).options.headers.Authorization,'Bearer test-jwt');
 await api.insert('assignments',{title:'Sample'});
 assert.equal(logs.at(-1).options.headers.Prefer,'return=representation');
 assert.equal(logs.at(-1).options.method,'POST');
 console.log('PASS: mock REST Auth, OTP verify, authorization, table read and insert.');
})().catch(err=>{console.error(err);process.exitCode=1});
