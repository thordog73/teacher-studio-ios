/* Supabase-compatible REST client — no CDN or runtime SDK required. */
(function(global){'use strict';
class CloudAPI{
 constructor(url,key){this.url=String(url||'').replace(/\/+$/,'');this.key=String(key||'').trim();if(!/^https:\/\/[^\s/]+\.supabase\.co$/.test(this.url))throw Error('Enter a valid https://<project>.supabase.co URL.');if(!this.key)throw Error('Enter a publishable or anon key.');this.session=null;}
 async request(path,{method='GET',body=null,token,headers={},asBlob=false}={}){
  const h={apikey:this.key,...headers};const bearer=token===undefined?this.session?.access_token:token;
  if(bearer)h.Authorization='Bearer '+bearer;
  if(body!==null&&!(body instanceof Blob)&&!(body instanceof ArrayBuffer))h['Content-Type']='application/json';
  const response=await fetch(this.url+path,{method,headers:h,body:body===null?undefined:(body instanceof Blob||body instanceof ArrayBuffer?body:JSON.stringify(body)),cache:'no-store'});
  if(!response.ok){let data;try{data=await response.json()}catch{data={message:await response.text()}};throw Error(data.msg||data.message||data.error_description||data.error||`Request failed (${response.status})`)}
  if(asBlob)return response.blob();const text=await response.text();if(!text)return null;try{return JSON.parse(text)}catch{return text}
 }
 async sendOtp(email){return this.request('/auth/v1/otp',{method:'POST',body:{email,create_user:true}})}
 async verifyOtp(email,token){let s=await this.request('/auth/v1/verify',{method:'POST',body:{email,token,type:'email'}});if(!s.access_token)throw Error('OTP verified without session.');this.session=s;return s}
 async refresh(){if(!this.session?.refresh_token)return null;const s=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token},token:null});this.session=s;return s}
 async user(){return this.request('/auth/v1/user')}
 async signout(){try{await this.request('/auth/v1/logout',{method:'POST'})}finally{this.session=null}}
 async table(name,query='?select=*',opts={}){return this.request('/rest/v1/'+encodeURIComponent(name)+query,opts)}
 async insert(name,data){return this.table(name,'?select=*',{method:'POST',body:data,headers:{Prefer:'return=representation'}})}
 async patch(name,query,data){return this.table(name,query,{method:'PATCH',body:data,headers:{Prefer:'return=representation'}})}
 async remove(name,query){return this.table(name,query,{method:'DELETE',headers:{Prefer:'return=representation'}})}
 async rpc(name,data){return this.request('/rest/v1/rpc/'+encodeURIComponent(name),{method:'POST',body:data})}
 async upload(path,file){const safe=path.split('/').map(encodeURIComponent).join('/');return this.request('/storage/v1/object/teacher-assignments/'+safe,{method:'POST',body:file,headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'}})}
 async download(path){const safe=path.split('/').map(encodeURIComponent).join('/');return this.request('/storage/v1/object/authenticated/teacher-assignments/'+safe,{asBlob:true})}
}
global.TeacherCloud=CloudAPI;
})(window);
