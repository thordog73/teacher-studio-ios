/* Teacher Studio Build 12. The family desk reuses classroom messages and School Hub.
   Request workflows are fictional, local practice. This module never sends network requests. */
(function (global) {
'use strict';
const KEY = 'teacherstudio_communication_v12';
const E = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const offsetDate = n => {const d=new Date();d.setDate(d.getDate()+n);return localDate(d);};
const prettyDate = value => value ? new Date(String(value).slice(0,10)+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}) : 'No date set';
const OPTIONS = [['attendance','Attendance','Absent, late, or leaving early','calendar'],['dismissal','Going home','Today’s plan and changes','bus'],['learning','Schoolwork & grades','Missing work and next steps','book'],['dates','Dates & forms','Days off, events, and responses','check'],['messages','Messages & calls','Private replies and class updates','message'],['help','Help & school info','Answers and the right contact','help']];
const METHODS = [['bus','Bus'],['pickup','Caregiver pickup'],['daycare','Daycare'],['walk','Walking'],['activity','After-school activity'],['other','Other']];
const STATUS = {pending:'Awaiting review',reviewed:'Reviewed',confirmed:'Confirmed in practice',declined:'Declined in practice',cancelled:'Withdrawn',call_needed:'Call needed',attempted:'Call attempted',voicemail:'Voicemail left',reached:'Contact made',follow_up:'Follow-up needed',resolved:'Resolved'};
const OWNER = {teacher:'Class teacher',office:'School office',family:'Family'};
const TYPE = {attendance:'Attendance',dismissal:'Going home',call:'Phone call',support:'Question / support',conference:'Conference'};
const PATHS = {
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3"/>',
 bus:'<rect x="4" y="3" width="16" height="16" rx="4"/><path d="M4 12h16M7 19v2M17 19v2M8 16h.01M16 16h.01M8 7h8"/>',
 book:'<path d="M12 6c-3-3-8-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-7-1-10 2Z M12 6v15"/>',
 check:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 13 3 3 5-7"/>',
 message:'<path d="M21 11a9 9 0 0 1-13 8l-5 2 1-6A9 9 0 1 1 21 11Z"/><path d="M8 9h8M8 13h5"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01"/>',
 phone:'<path d="m5 3 4 1 1 5-3 2a17 17 0 0 0 6 6l2-3 5 1 1 4c-1 4-7 1-11-2S0 6 5 3Z"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9M10 21h4"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]||PATHS.help}</svg>`;
const opt = (items,value) => items.map(([id,label])=>`<option value="${E(id)}" ${String(id)===String(value)?'selected':''}>${E(label)}</option>`).join('');
const action = (label,what,extra='',primary=false) => `<button type="button" class="cm-button ${primary?'cm-primary':''}" data-comm="${E(what)}" ${extra}>${E(label)}</button>`;
const nav = (label,page) => action(label,'navigate',`data-page="${E(page)}"`);
const terminal = r => ['confirmed','declined','resolved','cancelled'].includes(r.status);
let meta=null, current=null, signature='', section='home', studentId='', selectedDate=localDate(), queueFilter='action';
let faqQuery='', faqCategory='all', faqEditor=null, composeKind='announcement', replyTo=null, formOpen='', error='', success='', searchTimer;
const stores=new Map();
function ctx(){return {role:meta.role,mode:meta.mode,actorId:meta.actorId,guardianIds:meta.guardianIds||[],studentIds:(meta.students||[]).map(s=>s.id),today:localDate(),now:new Date().toISOString()};}
function people(){return (meta.students||[]).filter(s=>meta.role==='teacher'||(meta.guardianIds||[]).includes(s.id));}
function name(id){return people().find(s=>s.id===id)?.display_name||'Selected child';}
function teacher(){return meta?.role==='teacher';}
function active(){return people().find(s=>s.id===studentId);}
function fresh(){global.teacherStudioRender?.();}
function model(){if(!global.TeacherCommunicationModel)throw Error('The family workflow model is missing. Reopen the complete app.');return global.TeacherCommunicationModel;}
function load(){
 const id=meta.classroom.id;
 let data=stores.get(id);
 if(!data)try {const raw=JSON.parse(localStorage.getItem(KEY+':'+id)||'null');if(raw?.version===12&&raw.classId===id&&Array.isArray(raw.requests)&&Array.isArray(raw.dismissalPlans))data=raw;}catch{}
 if(!data){data=model().seed({...meta,classId:id},localDate());try{localStorage.setItem(KEY+':'+id,JSON.stringify(data));}catch{error='Browser storage is unavailable. These sample changes may not survive closing the app.';}}
 // The classroom owns its roster. Refresh that snapshot without discarding requests.
 const students=(meta.students||[]).map(s=>({id:s.id,display_name:s.display_name||''}));
 if(JSON.stringify(students)!==JSON.stringify(data.students)){
  data={...data,students,studentIds:students.map(s=>s.id)};
  try{localStorage.setItem(KEY+':'+id,JSON.stringify(data));}catch{error='The current roster is shown, but browser storage could not save this update.';}
 }
 stores.set(id,data);return data;
}
function persist(next){
 try{localStorage.setItem(KEY+':'+meta.classroom.id,JSON.stringify(next));}catch{throw Error('The change could not be saved. Free some browser storage and try again.');}
 stores.set(meta.classroom.id,next);current=next;return next;
}
function commit(type,payload){
 if(meta.mode!=='demo')throw Error('These workflows are available in fictional local practice only.');
 return persist(model().dispatch(current,{type,payload},ctx()));
}
function familyInfo(){return global.TeacherExtras?.getFamilyInfo?.(meta)||{school:{},events:[],faqs:[]};}
function prefs(id=studentId){return current?.preferences?.[id]?.[meta.actorId]||{};}
function requests(id){return model().getVisibleRequests(current,ctx(),id);}
function visibleMessages(){
 const list=(meta.messages||[]).filter(m=>m.classroom_id===meta.classroom.id);
 return list.filter(m=>teacher()||m.kind==='announcement'||((meta.guardianIds||[]).includes(m.student_id)&&(m.sender_id===meta.actorId||m.recipient_id===meta.actorId)))
  .filter(m=>teacher()||m.kind==='announcement'||m.student_id===studentId).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
}
function metaForMessage(m){return current.messageMeta?.[m.id]||{};}
function relevantForms(){return (current.forms||[]).filter(f=>teacher()||!f.studentIds?.length||f.studentIds.includes(studentId));}
function responseFor(f,id){return (current.formResponses||[]).find(r=>r.formId===f.id&&r.studentId===id&&(teacher()||r.guardian===meta.actorId));}
function pendingForms(id=studentId){return relevantForms().filter(f=>(!f.studentIds?.length||f.studentIds.includes(id))&&!responseFor(f,id));}
function outstandingAcknowledgments(){return visibleMessages().filter(m=>{const x=metaForMessage(m);return x.requirement==='ack'&&(!m.student_id||m.student_id===studentId)&&!x.acknowledgments?.[studentId];});}
function ensureChild(){if(!active())throw Error('Select a child linked to this classroom.');return studentId;}
function studentField(){return teacher()?`<label>Child<select name="studentId" required>${opt(people().map(s=>[s.id,s.display_name]),studentId)}</select></label>`:`<input type="hidden" name="studentId" value="${E(studentId)}">`;}
function planLabel(plan){return plan?.method ? `${METHODS.find(x=>x[0]===plan.method)?.[1]||plan.method}${plan.detail?' · '+plan.detail:''}${plan.adult?' · '+plan.adult:''}`:'No confirmed plan recorded';}
function dateField(label='Date',value=selectedDate){return `<label>${E(label)}<input name="date" type="date" value="${E(value)}" min="${localDate()}" required></label>`;}
function noticeBlock(){return `<div class="cm-local">${icon('help')}<span><strong>Practice on this device.</strong> These fictional requests, calls, and responses do not notify the school or another phone.</span></div>`;}
function flash(){return `${error?`<div class="cm-feedback cm-error" role="alert">${E(error)}</div>`:''}${success?`<div class="cm-feedback cm-success" role="status">${E(success)}</div>`:''}`;}
function header(){
 return `<div class="cm-heading"><div><div class="cm-eyebrow">${teacher()?'YOUR CLASSROOM, CONNECTED':'YOUR CHILD’S SCHOOL DAY'}</div><h2>${section==='home'?(teacher()?'Know what needs your attention.':'A little clarity for a busy day.'):(OPTIONS.find(x=>x[0]===section)?.[1]||'Today & families')}</h2><p>${teacher()?'Answers, requests, and follow-up in one place.':'Find an answer, take the next step, and check what happens next.'}</p></div><div class="cm-context"><div class="cm-class-picker">${meta.classPicker||''}</div>${people().length?`<label>${teacher()?'Child details':'Your child'}<select id="cm-student" data-comm-select="student">${opt(people().map(s=>[s.id,s.display_name]),studentId)}</select></label>`:''}</div></div>`;
}
function tiles(){return `<div class="cm-tiles">${OPTIONS.map(([id,title,desc,pic])=>`<button type="button" class="cm-tile" data-comm="tab" data-tab="${id}"><span class="cm-tile-icon">${icon(pic)}</span><span><strong>${title}</strong><small>${desc}</small></span><span class="cm-tile-arrow">${icon('arrow')}</span></button>`).join('')}</div>`;}
function miniFAQ(category){
 const items=familyInfo().faqs.filter(f=>(f.category||'help')===category).slice(0,3);
 return `<section class="cm-card cm-mini-faq"><div class="cm-section-head"><h3>Quick answers</h3>${action('All questions','tab','data-tab="help"')}</div>${items.map(f=>`<details><summary>${E(f.q||f.question)}</summary><p>${E(f.a||f.answer)}</p></details>`).join('')||'<p>More questions can be added in Help & school info.</p>'}</section>`;
}
function home(){
 const mine=requests(studentId).filter(r=>!terminal(r));
 const myAction=mine.filter(r=>teacher()?r.owner==='teacher':r.owner==='family');
 const plan=active()?model().getPlan(current,studentId,localDate()):null;
 const dueForms=active()?pendingForms():[];
 const acks=active()?outstandingAcknowledgments():[];
 const events=familyInfo().events.filter(x=>x.date>=localDate()).sort((a,b)=>a.date.localeCompare(b.date));
 const notes=visibleMessages().filter(m=>m.kind==='announcement').slice(0,1);
 const summary=`<section class="cm-today"><div class="cm-section-head"><h3>${teacher()?'Selected child’s day':'Today'} <span>${E(prettyDate(localDate()))}</span></h3>${active()?`<span class="cm-child-name">${E(name(studentId))}</span>`:''}</div><div class="cm-today-lines"><button class="cm-summary-line" type="button" data-comm="tab" data-tab="dismissal">${icon('bus')}<span><small>Going home · sample plan</small><strong>${E(planLabel(plan))}</strong></span>${icon('arrow')}</button>${myAction.slice(0,2).map(r=>`<button class="cm-summary-line ${r.type==='call'?'cm-call':''}" type="button" data-comm="tab" data-tab="messages">${icon(r.type==='call'?'phone':'message')}<span><small>${r.type==='call'?(r.owner==='family'?'Please call the teacher':'Call the family'):'Needs your response'}</small><strong>${E(r.summary)}</strong><small>${E(STATUS[r.status]||r.status)} · ${E(prettyDate(r.dueDate||r.date))}</small></span>${icon('arrow')}</button>`).join('')}${dueForms.length?`<button class="cm-summary-line" type="button" data-comm="tab" data-tab="dates">${icon('check')}<span><small>${dueForms.length} form${dueForms.length===1?'':'s'} waiting</small><strong>${E(dueForms[0].title)}</strong><small>Due ${E(prettyDate(dueForms[0].dueDate))}</small></span>${icon('arrow')}</button>`:''}${acks.length?`<button class="cm-summary-line" type="button" data-comm="tab" data-tab="messages">${icon('bell')}<span><strong>${acks.length} notice${acks.length===1?'':'s'} to acknowledge</strong><small>Opening a notice does not mark it acknowledged.</small></span>${icon('arrow')}</button>`:''}${!myAction.length&&!dueForms.length&&!acks.length?'<p class="cm-empty">No response is currently due for this child in the practice desk.</p>':''}</div></section>`;
 return `${teacher()?queue(true):''}${summary}${tiles()}<div class="cm-columns"><section class="cm-card"><div class="cm-section-head"><h3>Coming up</h3>${action('Dates & forms','tab','data-tab="dates"')}</div>${events.slice(0,3).map(x=>`<article class="cm-list-item"><span class="cm-date">${E(prettyDate(x.date))}</span><strong>${E(x.title)}</strong><p>${E(x.notes||x.type)}</p></article>`).join('')||'<p class="cm-empty">No upcoming calendar items have been entered.</p>'}</section><section class="cm-card"><div class="cm-section-head"><h3>Latest class update</h3>${action('Open messages','tab','data-tab="messages"')}</div>${notes.map(m=>`<p class="cm-message-body">${E(m.body)}</p><small>Fictional class announcement · ${E(prettyDate(m.created_at))}</small>`).join('')||'<p class="cm-empty">No class announcements yet.</p>'}${nav(teacher()?'Invitations & class setup':'Join another classroom','family')}</section></div>`;
}
function queue(compact=false){
 const filtered=id=>model().getQueue(current,ctx(),id).filter(r=>teacher()||r.studentId===studentId).sort((a,b)=>id==='completed'?String(b.updatedAt).localeCompare(String(a.updatedAt)):String(a.dueDate||a.date).localeCompare(String(b.dueDate||b.date))||String(a.createdAt).localeCompare(String(b.createdAt)));
 const list=filtered(queueFilter);
 const filters=[['action','Needs my action'],['waiting','Waiting for someone'],['completed','Completed']];
 return `<section class="cm-card cm-queue"><div class="cm-section-head"><div><div class="cm-eyebrow">${teacher()?'WHOLE CLASSROOM':'YOUR REQUESTS'}</div><h3>Follow-up</h3></div>${teacher()?action('Add a call / follow-up','new-request','data-type="call"',true):''}</div><div class="cm-tabs" aria-label="Follow-up views">${filters.map(([id,label])=>`<button type="button" class="${queueFilter===id?'active':''}" aria-pressed="${queueFilter===id}" data-comm="queue" data-filter="${id}">${label}<span>${filtered(id).length}</span></button>`).join('')}</div>${list.length?(compact?list.slice(0,5):list).map(r=>requestCard(r,!compact)).join(''):`<p class="cm-empty">${queueFilter==='action'?'No open requests assigned to you.':queueFilter==='waiting'?'Nothing is waiting on another person.':'Completed requests will stay here for reference.'}</p>`}${compact&&list.length>5?action('View all follow-up','tab','data-tab="messages"'):''}</section>`;
}
function requestCard(r,expanded=false){
 const myTurn=teacher()?r.owner==='teacher':r.owner==='family';
 const direction=r.type==='call'?(r.owner==='family'?'Family to call teacher':r.owner==='teacher'?'Teacher to call family':'Office follow-up'):OWNER[r.owner];
 const deadline=r.dueDate||r.date;const late=!terminal(r)&&deadline&&deadline<localDate();
 const history=(current.history||[]).filter(h=>h.recordId===r.id);
 const details=r.details||{};
 return `<article class="cm-request ${r.type==='call'&&myTurn&&!terminal(r)?'cm-phone-needed':''}" data-request-id="${E(r.id)}"><div class="cm-request-top"><div class="cm-request-icon">${icon(r.type==='call'?'phone':r.type==='dismissal'?'bus':r.type==='attendance'?'calendar':'message')}</div><div><strong>${E(r.summary)}</strong><div class="cm-small">${E(name(r.studentId))} · ${E(TYPE[r.type])} · ${E(prettyDate(r.date))}</div></div><span class="cm-status ${terminal(r)?'done':myTurn?'needs':'waiting'}">${E(STATUS[r.status]||r.status)}</span></div><div class="cm-request-meta"><span>${E(direction)}${!r.visibleToFamily?' · Teacher-only note':''}</span>${deadline?`<span class="${late?'cm-overdue':''}">${late?'Past requested date: ':'Requested by '}${E(prettyDate(deadline))}</span>`:''}</div>${r.type==='dismissal'?`<p class="cm-detail">Requested: ${E(METHODS.find(x=>x[0]===details.method)?.[1]||details.method||'Change')} ${E(details.detail||'')}${details.adult?' · '+E(details.adult):''}</p>`:''}${details.earlyTime?`<p class="cm-detail">Time: ${E(details.earlyTime)}${details.adult?' · '+E(details.adult):''}</p>`:''}${details.proposedTime?`<p class="cm-detail">Availability: ${E(details.proposedTime)}</p>`:''}${expanded&&details.detail&&r.type!=='dismissal'?`<p class="cm-message-body">${E(details.detail)}</p>`:''}${teacher()&&r.type==='call'&&myTurn&&!terminal(r)?familyCallback(r):''}${teacher()?`<details class="cm-review" ${expanded&&!terminal(r)?'open':''}><summary>${r.owner==='office'?'Practice office review':'Update follow-up'}</summary>${statusForm(r)}${history.length?`<div class="cm-history">${history.slice(-4).map(h=>`<div>${E(h.to?(STATUS[h.from]||h.from)+' → '+(STATUS[h.to]||h.to)+(h.note?' · '+h.note:''):'Request created')} <small>${E(prettyDate(h.at||h.timestamp||h.createdAt))}</small></div>`).join('')}</div>`:''}</details>`:(!terminal(r)&&r.createdBy===meta.actorId&&r.status==='pending'?action('Withdraw request','cancel-request',`data-id="${E(r.id)}"`):r.type==='call'&&myTurn&&!terminal(r)?`<div class="cm-actions">${phoneLink(current.settings?.teacherPhone,'Call teacher')}${action('Send a private reply','tab','data-tab="messages"')}</div>`:'')}</article>`;
}
function statusForm(r){
 const allowed=model().allowedStatuses(r);
 const order=r.type==='call'?['attempted','voicemail','reached','follow_up','resolved','call_needed','cancelled']:['reviewed','confirmed','follow_up','resolved','declined','cancelled'];
 const statuses=order.filter(s=>allowed.includes(s)&&(!terminal(r)||s!==r.status));
 if(!statuses.length)return '<p class="cm-small">This request is closed. Create a new request for any further action.</p>';
 return `<form data-comm-form="status" data-id="${E(r.id)}"><div class="cm-fields"><label>New status<select name="status" required><option value="" selected>Choose the outcome</option>${opt(statuses.map(s=>[s,STATUS[s]||s]),'')}</select></label><label>Next responsible person<select name="owner">${opt(Object.entries(OWNER),r.owner)}</select></label></div>${r.type==='dismissal'||(r.type==='attendance'&&r.details?.attendanceReason==='early')?`<label class="cm-checkbox"><input name="verified" type="checkbox"><span>${(r.details?.method==='pickup'||r.details?.attendanceReason==='early')?'I checked the adult’s pickup authorization and identity using the school procedure.':'I checked the requested transport arrangement.'} <strong>Practice verification only.</strong></span></label>`:''}<label>Follow-up note<input name="note" maxlength="500" placeholder="What happened? What is the next step?"></label><button type="submit" class="cm-button cm-primary">Save practice update</button></form>`;
}
function phoneLink(value,label){const p=String(value||'').replace(/[^+\d]/g,'');return p?`<a class="cm-button" href="tel:${E(p)}">${E(label)}</a>`:`<span class="cm-small">${E(label)}: number not provided.</span>`;}
function familyPreferences(){
 const all=model().getPreferences(current,ctx(),studentId);
 return Object.values(all).filter(p=>(meta.links||[]).some(l=>l.student_id===studentId&&l.guardian_id===p.actorId));
}
function preferenceCard(p){
 const link=(meta.links||[]).find(l=>l.student_id===p.studentId&&l.guardian_id===p.actorId);
 return `<div class="cm-contact-pref"><strong>${E(link?.guardian_email||'Linked guardian')}</strong><div class="cm-actions">${phoneLink(p.phone,'Call family')}</div><p class="cm-small">${E(p.contactMethod?'Preferred contact: '+p.contactMethod:'')}${p.callbackWindow?'<br>Suitable times: '+E(p.callbackWindow):''}${p.language?'<br>Language / format: '+E(p.language):''}</p></div>`;
}
function familyCallback(r){
 const values=Object.values(model().getPreferences(current,ctx(),r.studentId)).filter(p=>(meta.links||[]).some(l=>l.student_id===r.studentId&&l.guardian_id===p.actorId));
 const recipient=r.recipientActorId||(r.createdRole==='parent'?r.createdBy:null);
 const selected=recipient?values.filter(p=>p.actorId===recipient):values;
 return `<div class="cm-callback">${selected.length?selected.map(preferenceCard).join(''):'<p class="cm-small">No callback number or suitable times have been saved by this family in the practice desk.</p>'}</div>`;
}
function requestComposer(kind='support'){
 const isTeacher=teacher();const title=kind==='call'?'Arrange a call':kind==='conference'?'Request a conference':'Ask for help';
 return `<section class="cm-card"><div class="cm-section-head"><h3>${title}</h3>${action('Close','close-form')}</div><form data-comm-form="request" data-type="${kind}">${studentField()}<label>Topic<input name="summary" required maxlength="180" placeholder="For example: reading practice at home"></label><label>Details<textarea name="detail" maxlength="1500" rows="3" placeholder="Include the question and what would help. Use fictional details only."></textarea></label><div class="cm-fields"><label>Requested by<input name="dueDate" type="date" value="${offsetDate(1)}" min="${localDate()}"></label><label>Suitable times<input name="proposedTime" maxlength="180" placeholder="For example: after 4 pm"></label></div>${isTeacher?`<label>Who should act?<select name="owner">${opt(Object.entries(OWNER),'teacher')}</select></label><label class="cm-checkbox"><input type="checkbox" name="visibleToFamily"><span>Share this request with the child’s authorized family. Leave unchecked for a teacher-only follow-up.</span></label>`:'<p class="cm-small">This private request is addressed to the class teacher. No appointment or call is confirmed by saving it.</p>'}<button type="submit" class="cm-button cm-primary">Save practice request</button></form></section>`;
}
function attendance(){
 const list=requests(studentId).filter(r=>r.type==='attendance');
 return `<div class="cm-columns"><section class="cm-card"><h3>Report an absence or change in attendance</h3><p class="cm-muted">Choose the date and what the office needs to review.</p><form data-comm-form="attendance">${studentField()}<div class="cm-fields">${dateField()}<label>What is changing?<select name="attendanceReason" data-comm-select="attendance-reason">${opt([['absent','Absent'],['late','Arriving late'],['early','Leaving early']],'absent')}</select></label></div><div class="cm-fields"><label>Arrival / pickup time, if needed<input type="time" name="earlyTime"></label><label>Collecting adult, for early pickup<input name="adult" maxlength="100" placeholder="Fictional caregiver name"></label></div><label>Brief note<textarea name="detail" maxlength="800" rows="2" placeholder="Only what the office needs to review."></textarea></label><button type="submit" class="cm-button cm-primary">Save practice attendance request</button></form><p class="cm-small">Early pickup is recorded once and appears in follow-up. An early pickup changes that day’s plan only after the teacher records the adult check and confirms it in practice.</p>${action('Check the going-home plan','tab','data-tab="dismissal"')}</section>${miniFAQ('attendance')}</div><section class="cm-card"><h3>Attendance requests for ${E(name(studentId))}</h3>${list.map(r=>requestCard(r,true)).join('')||'<p class="cm-empty">No attendance requests yet.</p>'}</section>`;
}
function dismissal(){
 const plan=model().getPlan(current,studentId,selectedDate);
 const list=requests(studentId).filter(r=>(r.type==='dismissal'||(r.type==='attendance'&&r.details?.attendanceReason==='early'))&&r.date===selectedDate);
 const pending=list.filter(r=>!terminal(r));
 return `<section class="cm-card"><div class="cm-section-head"><h3>${E(name(studentId))} · going home</h3><label>Plan date<input type="date" value="${E(selectedDate)}" data-comm-select="date"></label></div><div class="cm-plan"><span class="cm-plan-icon">${icon('bus')}</span><div><small>${plan.source==='none'?'PLAN NOT RECORDED':'CONFIRMED PLAN · FICTIONAL PRACTICE'}</small><strong>${E(planLabel(plan))}</strong><p>${plan.source==='request'?'A practice change was confirmed for this date only.':plan.source==='default'?'From the usual weekly arrangement.':'Ask the school office to confirm the arrangement.'}</p></div></div>${pending.length?`<div class="cm-pending"><strong>${pending.length} change${pending.length===1?' is':'s are'} awaiting review</strong><p>The confirmed plan above stays in place while a change is pending.</p></div>`:''}</section><div class="cm-columns"><section class="cm-card"><h3>Request a one-day change</h3><form data-comm-form="dismissal">${studentField()}<div class="cm-fields">${dateField('For this date')}<label>New arrangement<select name="method" data-comm-select="method">${opt(METHODS,'pickup')}</select></label></div><label>Collecting adult (required for pickup)<input name="adult" maxlength="100" placeholder="Fictional caregiver name"></label><label>Bus, daycare, location, or other details<input name="detail" maxlength="240" placeholder="Specify the destination or arrangement"></label><button class="cm-button cm-primary" type="submit">Save practice change request</button></form><p class="cm-small">One-day changes expire after their date. Pickup codes, if used by the school, support its authorization process; knowing a code alone does not authorize an adult. No real pickup codes belong in this practice desk.</p>${current.settings?.dismissalCutoff?`<p class="cm-pending">Same-day cutoff entered for practice: ${E(current.settings.dismissalCutoff)}. Later changes require contacting the office.</p>`:'<p class="cm-small">A same-day cutoff has not been provided. Confirm urgent changes with the school office.</p>'}${phoneLink(familyInfo().school?.phone,'Call school office')}</section>${teacher()?`<section class="cm-card"><h3>Usual weekly arrangement</h3><p class="cm-muted">Set the normal plan once. Dated requests appear separately.</p><form data-comm-form="plan">${studentField()}<label>Day<select name="weekday">${opt([['1','Monday'],['2','Tuesday'],['3','Wednesday'],['4','Thursday'],['5','Friday'],['6','Saturday'],['0','Sunday']],String(new Date(selectedDate+'T12:00:00').getDay()))}</select></label><label>Usual method<select name="method">${opt(METHODS,'bus')}</select></label><label>Route / destination<input name="detail" maxlength="240" placeholder="For example: Bus 12"></label><label>Authorized adult, for pickup<input name="adult" maxlength="100"></label><button type="submit" class="cm-button cm-primary">Save usual practice plan</button></form>${action('Print today’s practice list','print-dismissal')}</section>`:miniFAQ('dismissal')}</div><section class="cm-card"><h3>Requests for ${E(prettyDate(selectedDate))}</h3>${list.map(r=>requestCard(r,true)).join('')||'<p class="cm-empty">No requests for this date.</p>'}</section>${teacher()?miniFAQ('dismissal'):''}`;
}
function learning(){
 const assignments=(meta.assignments||[]).filter(a=>!a.student_id||a.student_id===studentId);
 const released=(meta.results||[]).filter(r=>r.student_id===studentId&&r.released_at&&meta.classroom.share_grades);
 const stored=current.learning?.[studentId]||{};
 return `<div class="cm-section-head"><p class="cm-muted">Assignments and released results use the existing classroom records.</p>${teacher()?nav('Assignments & score review','assignments'):nav('Open assignments','assignments')}</div><div class="cm-columns"><section class="cm-card"><h3>Work and next steps</h3>${assignments.map(a=>{const item=stored[a.id]||{},result=released.find(r=>r.assignment_id===a.id);return `<article class="cm-assignment"><div class="cm-section-head"><h4>${E(a.title)}</h4><span class="cm-status ${item.status==='missing'?'needs':''}">${E(({missing:'Missing · marked by teacher',upcoming:'Upcoming',submitted:'Submitted',complete:'Complete'})[item.status]||'Status not marked')}</span></div><small>Due ${E(prettyDate(a.due_date))}</small><p>${E(a.instructions||'Instructions have not been provided.')}</p>${item.practiceNote?`<div class="cm-next-step"><strong>Try this next</strong><p>${E(item.practiceNote)}</p></div>`:''}${result?`<p class="cm-grade"><strong>${E(result.score)} / ${E(result.max_score)}</strong> · Teacher-released result<br>${E(result.notes||'')}</p>`:'<p class="cm-small">No released result for this work. This does not mean the work is missing.</p>'}${teacher()?`<details><summary>Mark work status / next step</summary><form data-comm-form="learning" data-assignment-id="${E(a.id)}"><input type="hidden" name="studentId" value="${E(studentId)}"><label>Work status<select name="status">${opt([['upcoming','Upcoming'],['missing','Missing'],['submitted','Submitted'],['complete','Complete']],item.status||'upcoming')}</select></label><label>One useful next step<textarea name="practiceNote" maxlength="1000" rows="2">${E(item.practiceNote||'')}</textarea></label><button class="cm-button" type="submit">Save practice guidance</button></form></details>`:''}</article>`;}).join('')||'<p class="cm-empty">No assignments have been shared for this child.</p>'}</section><div>${miniFAQ('learning')}<section class="cm-card"><h3>Talk about learning</h3><p>Ask for one manageable activity, discuss a support need, or arrange a conversation.</p><div class="cm-actions">${action('Ask for learning support','new-request','data-type="support"')}${action('Request a conference','new-request','data-type="conference"')}</div>${teacher()?nav('Teacher-released grades','reports'):nav('View released grades','family')}</section></div></div>`;
}
function dates(){
 const events=familyInfo().events.filter(x=>x.date>=localDate()).sort((a,b)=>a.date.localeCompare(b.date));
 const forms=relevantForms();
 return `<div class="cm-columns"><section class="cm-card"><div class="cm-section-head"><h3>School calendar & preparations</h3>${nav('Full school calendar','hub')}</div>${events.map(x=>`<article class="cm-list-item"><span class="cm-date">${E(prettyDate(x.date))}</span><div class="cm-section-head"><strong>${E(x.title)}</strong><span class="cm-status">${E(x.type)}</span></div><p>${E(x.notes||'No additional instructions entered.')}</p></article>`).join('')||'<p class="cm-empty">No upcoming items entered. Check the school’s current calendar for opening hours.</p>'}${teacher()?`<details><summary>Add a date or tomorrow’s preparation</summary><form data-comm-form="event"><label>Title<input name="title" required maxlength="160" placeholder="For example: bring library books"></label><div class="cm-fields">${dateField()}<label>Type<select name="type">${opt([['Event','Event'],['No school','No school'],['Early dismissal','Early dismissal'],['Bring to class','Bring to class'],['School day','School day']],'Event')}</select></label></div><label>Time / instructions<textarea name="notes" maxlength="1000" rows="2" placeholder="Enter the school-provided time and any items to bring."></textarea></label><button type="submit" class="cm-button">Save calendar item</button></form></details>`:''}</section><section class="cm-card"><h3>Forms and permission responses</h3><p class="cm-small">Responses are recorded for each child and guardian. Opening a form does not answer it.</p>${forms.map(f=>{const response=responseFor(f,studentId),targets=f.studentIds?.length?f.studentIds:people().map(s=>s.id);const answers=(current.formResponses||[]).filter(r=>r.formId===f.id&&targets.includes(r.studentId));const answeredChildren=new Set(answers.map(r=>r.studentId)).size;return `<article class="cm-form-item"><div class="cm-section-head"><h4>${E(f.title)}</h4><span class="cm-status ${response?'done':'waiting'}">${teacher()?answeredChildren+' / '+targets.length+' children responded':response?'Response saved here':'Response needed'}</span></div><small>Due ${E(prettyDate(f.dueDate))}</small><p>${E(f.body)}</p>${teacher()?`<details><summary>View responses</summary>${targets.map(id=>{const replies=answers.filter(x=>x.studentId===id);const conflict=new Set(replies.map(x=>x.response)).size>1;return `<div class="cm-response-row"><span>${E(name(id))}</span><span>${replies.length?replies.map(r=>E((meta.links||[]).find(l=>l.guardian_id===r.guardian&&l.student_id===id)?.guardian_email||'Guardian')+': '+E(r.response==='agreed'?'Agreed':'Declined')).join('<br>'):'Waiting'}${conflict?'<br><strong>Different responses — follow up with the family.</strong>':''}</span></div>`;}).join('')}</details>`:response?`<p class="cm-small">${E(response.response==='agreed'?'Agreed':'Declined')} · saved on this device only.</p>`:`<form data-comm-form="form-response" data-id="${E(f.id)}"><input type="hidden" name="studentId" value="${E(studentId)}"><label>Your response<select name="response"><option value="agreed">I agree / give permission in this practice example</option><option value="declined">I do not agree / cannot participate</option></select></label><button type="submit" class="cm-button cm-primary">Save practice response</button></form>`}</article>`;}).join('')||'<p class="cm-empty">No forms have been added.</p>'}${teacher()?`<details><summary>Create a form / permission request</summary><form data-comm-form="form-create"><label>Title<input name="title" required maxlength="180"></label><label>Instructions<textarea name="body" required maxlength="1500" rows="3"></textarea></label><div class="cm-fields"><label>Response due<input name="dueDate" type="date" required min="${localDate()}" value="${offsetDate(3)}"></label><label>For<select name="audience"><option value="class">All students in this class</option><option value="child">${E(name(studentId))}</option></select></label></div><button type="submit" class="cm-button cm-primary">Save practice form</button></form></details>`:''}</section></div>${miniFAQ('dates')}`;
}
function messages(){
 const msgs=visibleMessages(), linked=meta.links||[];
 const privateLink=replyTo?linked.find(l=>l.student_id===replyTo.student_id&&l.guardian_id===(replyTo.sender_id===meta.classroom.teacher_id?replyTo.recipient_id:replyTo.sender_id)):null;
 return `${queue(false)}<div class="cm-columns"><section class="cm-card"><h3>${teacher()?'Write a message':'Message your teacher'}</h3>${replyTo?`<div class="cm-replying"><strong>Private reply about</strong><p>${E(replyTo.body.slice(0,180))}</p>${action('Clear reply','clear-reply')}</div>`:''}${!teacher()&&!meta.classroom.allow_parent_replies?'<p class="cm-empty">The classroom currently has parent replies turned off. Use the contact details in Help & school info.</p>':`<form data-comm-form="message">${teacher()?`<label>Audience<select name="kind" data-comm-select="audience">${opt([['announcement','My class — linked families'],['direct','Private — one linked guardian']],composeKind)}</select></label><div class="${composeKind==='direct'?'':'cm-hidden'}"><label>Guardian and child<select name="linkId">${opt(linked.map(l=>[l.id,(l.guardian_email||'Guardian')+' · '+name(l.student_id)]),privateLink?.id||linked.find(l=>l.student_id===studentId)?.id||linked[0]?.id)}</select></label></div><div class="cm-audience">${composeKind==='announcement'?`Class: ${E(meta.classroom.name)} · ${linked.length} linked guardian${linked.length===1?'':'s'}`:'Private conversation with the selected guardian. Other families do not receive it.'}</div><p class="cm-small">School-wide publishing needs a school-authorized sender; this classroom account sends to its own class.</p>`:`<input type="hidden" name="studentId" value="${E(studentId)}"><div class="cm-audience">Private · ${E(name(studentId))} · to the class teacher</div>`}<label>Message<textarea name="body" required maxlength="3000" rows="4" placeholder="Write a question, a useful update, or some good news."></textarea></label><div class="cm-fields"><label>${teacher()?'What does this need?':'What would help?'}<select name="requirement"><option value="info">Information only</option>${teacher()?'<option value="ack">Please acknowledge</option>':''}<option value="reply">A private reply</option><option value="call">A phone call</option></select></label><label>Requested by, when needed<input type="date" name="dueDate" min="${localDate()}" value="${offsetDate(1)}"></label></div><button type="submit" class="cm-button cm-primary">Save fictional ${teacher()&&composeKind==='announcement'?'class message':'private message'}</button></form>`}</section><section class="cm-card"><h3>Class updates & private conversations</h3>${msgs.map(m=>messageCard(m)).join('')||'<p class="cm-empty">No messages for this audience yet.</p>'}</section></div>${miniFAQ('messages')}`;
}
function messageCard(m){
 const info=metaForMessage(m),canAcknowledge=!teacher()&&info.requirement==='ack',ack=info.acknowledgments?.[studentId];
 const targets=m.student_id?[m.student_id]:[...new Set((meta.links||[]).map(l=>l.student_id))];
 const acknowledged=targets.filter(id=>info.acknowledgments?.[id]).length;
 return `<article class="cm-message"><div class="cm-section-head"><span class="cm-status">${m.kind==='announcement'?'Class announcement':'Private family message'}</span><small>${E(prettyDate(m.created_at))}</small></div><p class="cm-message-body">${E(m.body)}</p>${info.requirement&&info.requirement!=='info'?`<p class="cm-small"><strong>${E(({ack:'Acknowledgment requested',reply:'Private reply requested',call:'Call requested'})[info.requirement]||info.requirement)}</strong>${info.dueDate?' · by '+E(prettyDate(info.dueDate)):''}</p>`:''}${teacher()&&info.requirement==='ack'?`<p class="cm-small">Acknowledged here for ${acknowledged} / ${targets.length} linked child${targets.length===1?'':'ren'}. One guardian response per child.</p>`:''}<div class="cm-actions">${canAcknowledge?(ack?'<span class="cm-confirmed">Acknowledged on this device</span>':action('I acknowledge this notice','ack',`data-id="${E(m.id)}"`,true)):''}${(!teacher()&&meta.classroom.allow_parent_replies)||(teacher()&&m.kind==='direct')?action('Reply privately','reply',`data-id="${E(m.id)}"`):''}${teacher()?action('Save as FAQ draft','message-to-faq',`data-id="${E(m.id)}"`):''}</div></article>`;
}
function help(){
 const info=familyInfo(),p=prefs();
 const faqs=info.faqs.filter(f=>faqCategory==='all'||(f.category||'help')===faqCategory).filter(f=>[f.q,f.a,...(f.keywords||[])].join(' ').toLowerCase().includes(faqQuery.toLowerCase()));
 return `<div class="cm-columns"><section class="cm-card"><h3>Find a quick answer</h3><div class="cm-fields"><label>Search questions<input type="search" id="cm-faq-search" value="${E(faqQuery)}" placeholder="Try sick, bus, missing work, or dyslexia"></label><label>Topic<select data-comm-select="faq-category">${opt([['all','All questions'],...OPTIONS.map(([id,title])=>[id,title])],faqCategory)}</select></label></div>${teacher()?action('Add an answer','edit-faq','data-id=""'):''}<div class="cm-faq-list">${faqs.map(f=>`<details class="cm-faq"><summary>${E(f.q||f.question)}</summary><p>${E(f.a||f.answer)}</p><small>${E(f.owner||'Class teacher')} · ${f.reviewedAt?'Reviewed '+E(prettyDate(f.reviewedAt)):'Starter answer — school review needed'}</small><div class="cm-actions">${action('Open '+(OPTIONS.find(x=>x[0]===(f.action==='contacts'?'help':f.action))?.[1]||'help'),'faq-action',`data-tab="${E(f.action||f.category||'help')}"`)}${action('Ask a person','new-request','data-type="support"')}${teacher()?action('Edit answer','edit-faq',`data-id="${E(f.id)}"`):''}</div></details>`).join('')||'<p class="cm-empty">No matching answer. You can ask the teacher a private question.</p>'}</div></section><div><section class="cm-card" id="cm-contacts"><h3>School contacts</h3><dl class="cm-details"><dt>School</dt><dd>${E(info.school?.name||meta.classroom.name)}</dd><dt>Office hours</dt><dd>${E(info.school?.office||'Not provided')}</dd><dt>Office phone</dt><dd>${phoneLink(info.school?.phone,'Call office')}</dd><dt>Teacher phone</dt><dd>${phoneLink(current.settings?.teacherPhone,'Call teacher')}</dd><dt>Usual response arrangements</dt><dd>${E(current.settings?.responseWindow||'Not provided — ask the school about contact hours.')}</dd><dt>Health or transport help</dt><dd>Contact the school office for its designated nurse or transport contact.</dd></dl><div class="cm-actions">${action('Request a conference','new-request','data-type="conference"')}${action('Ask for a call','new-request','data-type="call"')}</div></section>${teacher()?`<section class="cm-card"><h3>Family contact preferences</h3><p class="cm-small">For ${E(name(studentId))}. These are the linked guardians’ fictional callback details saved on this device.</p>${familyPreferences().map(preferenceCard).join('')||'<p class="cm-empty">No family preferences saved yet. Try Parent mode to enter a fictional callback number and suitable times.</p>'}</section>`:`<section class="cm-card"><h3>How would you like to communicate?</h3><p class="cm-small">Saved for this account and selected child in the local practice desk. This does not update school records.</p><form data-comm-form="preferences"><input type="hidden" name="studentId" value="${E(studentId)}"><label>Preferred language / format<input name="language" maxlength="100" value="${E(p.language||'')}" placeholder="For example: English, large text"></label><label>Preferred contact<select name="contactMethod">${opt([['message','Written message'],['phone','Phone call'],['email','Email'],['paper','Paper / office contact']],p.contactMethod||'message')}</select></label><label>Suitable callback times<input name="callbackWindow" maxlength="160" value="${E(p.callbackWindow||'')}"></label><label>Fictional contact phone<input name="phone" type="tel" maxlength="40" value="${E(p.phone||'')}" autocomplete="off"></label><button type="submit" class="cm-button">Save practice preferences</button></form></section>`}${teacher()?settingsForm(info):''}</div></div>`;
}
function settingsForm(info){return `<section class="cm-card"><details><summary>School communication settings</summary><form data-comm-form="settings"><label>School office phone<input name="schoolPhone" maxlength="40" value="${E(info.school?.phone||'')}"></label><label>School office hours<input name="officeHours" maxlength="160" value="${E(info.school?.office||'')}"></label><label>Teacher phone<input name="teacherPhone" maxlength="40" value="${E(current.settings?.teacherPhone||'')}"></label><label>Same-day dismissal cutoff<input name="dismissalCutoff" type="time" value="${E(current.settings?.dismissalCutoff||'')}"></label><label>Usual response arrangements<textarea name="responseWindow" maxlength="400" rows="2">${E(current.settings?.responseWindow||'')}</textarea></label><button class="cm-button" type="submit">Save practice settings</button></form></details></section>`;}
function faqEdit(){
 const f=faqEditor||{};
 return `<section class="cm-card cm-editor"><div class="cm-section-head"><h3>${f.id?'Edit FAQ':'New FAQ draft'}</h3>${action('Cancel','close-editor')}</div><p class="cm-small">Check school policy and remove names, grades, contact details, and anything about an individual child before publishing an answer.</p><form data-comm-form="faq"><input type="hidden" name="id" value="${E(f.id||'')}"><label>Parent’s question<input name="question" required maxlength="180" value="${E(f.q||f.question||'')}"></label><label>Short answer<textarea name="answer" required maxlength="3000" rows="4">${E(f.a||f.answer||'')}</textarea></label><div class="cm-fields"><label>Topic<select name="category">${opt(OPTIONS.map(([id,title])=>[id,title]),f.category||'help')}</select></label><label>Action to open<select name="action">${opt([...OPTIONS.map(([id,title])=>[id,title]),['contacts','School contacts']],f.action||'help')}</select></label></div><div class="cm-fields"><label>Maintained by<input name="owner" maxlength="80" value="${E(f.owner||'Class teacher')}"></label><label>Scope<select name="scope">${opt([['class','Classroom answer'],['school','School answer']],f.scope||'class')}</select></label></div><button type="submit" class="cm-button cm-primary">Save reviewed answer</button></form></section>`;
}
function render(input){
 meta=input;
 if(!meta.classroom||!meta.loggedIn)return global.TeacherFamily?.render(meta)||'<p>Choose a classroom first.</p>';
 const sig=[meta.classroom.id,meta.mode,meta.role,meta.actorId,meta.section||'home'].join('|');
 if(sig!==signature){signature=sig;section=meta.section||'home';studentId=people()[0]?.id||'';selectedDate=localDate();formOpen='';faqEditor=null;replyTo=null;error='';success='';composeKind=teacher()?'announcement':'direct';}
 if(!people().some(s=>s.id===studentId)){studentId=people()[0]?.id||'';replyTo=null;formOpen='';faqEditor=null;}
 if(meta.mode!=='demo')return `<div class="comm">${header()}<section class="cm-card"><h3>Connected family communication</h3><p>Assignments, grade release, invitations, and private messages use your connected classroom.</p><p>The new attendance, dismissal, callback, and form workflows are available as fictional local practice in this build.</p><div class="cm-actions">${nav('Open connected messages','messages')}${nav('Family setup & released work','family')}${nav('Choose fictional practice in Settings','settings')}</div></section></div>`;
 current=load();
 global.TeacherExtras?.ensureFamilyFAQs?.(global.TeacherFAQSeed||[]);
 if(!people().length)return `<div class="comm">${header()}<section class="cm-card"><h3>${teacher()?'Add a fictional student to get started':'No child is linked to this account'}</h3><p>${teacher()?'Use the existing class setup to add a student and connect a family.':'Use an invitation for the email the teacher authorized.'}</p>${nav('Open class setup','family')}</section></div>`;
 const content=section==='home'?home():section==='attendance'?attendance():section==='dismissal'?dismissal():section==='learning'?learning():section==='dates'?dates():section==='messages'?messages():help();
 return `<div class="comm" id="communication-desk">${header()}${noticeBlock()}${section!=='home'?`<div class="cm-breadcrumb">${action('Today','tab','data-tab="home"')}<span>/ ${E(OPTIONS.find(x=>x[0]===section)?.[1]||section)}</span></div>`:''}${flash()}${faqEditor?faqEdit():''}${formOpen?requestComposer(formOpen):''}${content}</div>`;
}
function fields(form){return Object.fromEntries([...new FormData(form).entries()].map(([k,v])=>[k,String(v).trim()]));}
async function submit(event){
 const form=event.target;if(!form?.dataset?.commForm)return;
 event.preventDefault();event.stopImmediatePropagation();error='';success='';
 const button=form.querySelector('button[type="submit"]');if(button?.disabled)return;if(button)button.disabled=true;
 try{
  if(meta?.mode!=='demo')throw Error('Use fictional local practice for this workflow.');
  const v=fields(form),kind=form.dataset.commForm;
  if(kind==='attendance'){
   if(v.attendanceReason==='early'&&(!v.earlyTime||!v.adult))throw Error('For early pickup, include a time and collecting adult.');
   if(v.attendanceReason==='late'&&!v.earlyTime)throw Error('Include the expected arrival time.');
   const summary=({absent:'Absence reported',late:'Late arrival requested',early:'Early pickup requested'})[v.attendanceReason];
   commit('request.create',{type:'attendance',studentId:v.studentId,date:v.date,summary,owner:'office',visibleToFamily:true,details:{attendanceReason:v.attendanceReason,earlyTime:v.earlyTime,adult:v.adult,detail:v.detail}});
  }else if(kind==='dismissal'){
   const cutoff=current.settings?.dismissalCutoff;if(v.date===localDate()&&cutoff&&new Date().toTimeString().slice(0,5)>=cutoff)throw Error('The entered same-day cutoff has passed. Contact the school office; the confirmed plan has not changed.');
   commit('request.create',{type:'dismissal',studentId:v.studentId,date:v.date,summary:'One-day going-home change',owner:'office',visibleToFamily:true,details:{method:v.method,adult:v.adult,detail:v.detail}});
  }else if(kind==='plan')commit('dismissal.plan',{studentId:v.studentId,weekday:Number(v.weekday),method:v.method,adult:v.adult,detail:v.detail});
  else if(kind==='status'){
   const r=current.requests.find(x=>x.id===form.dataset.id);if(!r)throw Error('Request not found.');
   commit('request.status',{id:r.id,status:v.status,owner:v.owner,note:v.note,verifiedAuthorizedAdult:!!form.elements.verified?.checked,verifiedRoute:!!form.elements.verified?.checked});
  }else if(kind==='request'){
   const owner=teacher()?v.owner:'teacher',type=form.dataset.type;
   if(teacher()&&owner==='family'&&!form.elements.visibleToFamily?.checked)throw Error('Share the request with the family when the family is responsible for the next step.');
   commit('request.create',{type,studentId:v.studentId,date:localDate(),dueDate:v.dueDate,summary:v.summary,owner,visibleToFamily:teacher()?!!form.elements.visibleToFamily?.checked:true,details:{detail:v.detail,proposedTime:v.proposedTime}});formOpen='';
  }else if(kind==='form-create')commit('form.create',{title:v.title,body:v.body,dueDate:v.dueDate,studentIds:v.audience==='child'?[ensureChild()]:people().map(s=>s.id)});
  else if(kind==='form-response')commit('form.respond',{formId:form.dataset.id,studentId:v.studentId,response:v.response});
  else if(kind==='preferences')commit('preference.save',{studentId:v.studentId,fields:{language:v.language,contactMethod:v.contactMethod,callbackWindow:v.callbackWindow,phone:v.phone}});
  else if(kind==='learning')commit('learning.save',{studentId:v.studentId,assignmentId:form.dataset.assignmentId,status:v.status,practiceNote:v.practiceNote});
  else if(kind==='settings'){
   commit('settings.save',{schoolPhone:'',teacherPhone:v.teacherPhone,dismissalCutoff:v.dismissalCutoff,responseWindow:v.responseWindow});
   global.TeacherExtras.saveFamilySchool({phone:v.schoolPhone,office:v.officeHours},meta);
  }else if(kind==='faq'){
   global.TeacherExtras.saveFamilyFAQ({...v,reviewedAt:localDate()},meta);faqEditor=null;faqQuery='';faqCategory='all';section='help';
  }else if(kind==='event')global.TeacherExtras.addFamilyEvent(v,meta);
  else if(kind==='message'){
   const isTeacher=teacher(),messageKind=isTeacher?v.kind:'direct';
   if(!['info','ack','reply','call'].includes(v.requirement)||(!isTeacher&&v.requirement==='ack'))throw Error('Choose a valid message response.');
   if(isTeacher&&messageKind==='announcement'&&['reply','call'].includes(v.requirement))throw Error('For a reply or call request, select one private guardian. Class notices can request an acknowledgment.');
   const link=isTeacher&&messageKind==='direct'?(meta.links||[]).find(l=>l.id===v.linkId):null;
   if(isTeacher&&messageKind==='direct'&&(!link||!people().some(s=>s.id===link.student_id)))throw Error('Select a linked guardian and child.');
   const targetStudent=isTeacher?(link?.student_id||null):ensureChild();
   const recipient=isTeacher?(link?.guardian_id||null):meta.classroom.teacher_id;
   const answered=!isTeacher&&replyTo?requests(studentId).find(r=>r.type==='support'&&r.owner==='family'&&!terminal(r)&&r.details?.messageId===replyTo.id):null;
   const prepare=messageId=>{
    let next=current;const apply=(type,payload)=>{next=model().dispatch(next,{type,payload},ctx());};
    if(isTeacher)apply('message.meta',{messageId,requirement:v.requirement,dueDate:v.requirement==='info'?'':v.dueDate,studentId:targetStudent});
    if(['call','reply'].includes(v.requirement))apply('request.create',{type:v.requirement==='call'?'call':'support',studentId:targetStudent,date:localDate(),dueDate:v.dueDate,summary:(v.requirement==='call'?'Call requested: ':'Reply requested: ')+v.body.slice(0,120),owner:isTeacher?'family':'teacher',visibleToFamily:true,...(isTeacher?{recipientActorId:recipient}:{}),details:{detail:v.body.slice(0,1500),messageId}});
    if(answered)apply('request.reply',{id:answered.id,messageId});
    return next;
   };
   prepare('preflight-message');
   const stored=await meta.sendMessage({body:v.body,kind:messageKind,linkId:v.linkId,studentId:isTeacher?undefined:targetStudent});
   try{const next=prepare(stored.id);if(next!==current)persist(next);}
   catch(failure){
    if(typeof meta.undoPracticeMessage==='function'){
     try{await meta.undoPracticeMessage(stored.id);}catch{throw Error('The message was saved, but its follow-up could not be saved. Check the conversation before trying again.');}
     throw failure;
    }
    throw Error('The message was saved, but its follow-up could not be saved. Check the conversation before trying again.');
   }
   replyTo=null;
  }else return;
  success=kind==='faq'?'Reviewed answer saved. It is available in the same School Hub FAQ collection.':kind==='event'?'Calendar item saved in the existing School Hub.':'Practice change saved on this device. No school or family has been notified.';
  fresh();
 }catch(err){error=err.message||'The change could not be saved.';fresh();}finally{if(button)button.disabled=false;}
}
function click(event){
 const b=event.target.closest?.('[data-comm]');if(!b)return;
 event.preventDefault();event.stopImmediatePropagation();error='';success='';
 try{
  const what=b.dataset.comm;
  if(what==='navigate'){meta.navigate(b.dataset.page);return;}
  if(what==='tab'){section=b.dataset.tab;formOpen='';faqEditor=null;replyTo=null;}
  else if(what==='queue')queueFilter=b.dataset.filter;
  else if(what==='new-request'){formOpen=b.dataset.type||'support';faqEditor=null;}
  else if(what==='close-form')formOpen='';
  else if(what==='cancel-request'){commit('request.status',{id:b.dataset.id,status:'cancelled'});success='Practice request withdrawn. Confirmed plans are unchanged.';}
  else if(what==='ack'){
   const m=visibleMessages().find(x=>x.id===b.dataset.id);if(!m)throw Error('This message is not in your conversation.');
   commit('message.ack',{messageId:m.id,studentId:ensureChild()});success='Acknowledgment saved on this device.';
  }else if(what==='reply'){
   replyTo=visibleMessages().find(x=>x.id===b.dataset.id);if(!replyTo)throw Error('Message not available.');composeKind='direct';section='messages';
  }else if(what==='clear-reply')replyTo=null;
  else if(what==='edit-faq'){
   if(!teacher())throw Error('Only the teacher can edit an answer.');faqEditor=familyInfo().faqs.find(f=>f.id===b.dataset.id)||{};formOpen='';
  }else if(what==='close-editor')faqEditor=null;
  else if(what==='message-to-faq'){
   if(!teacher())throw Error('Only the teacher can create an FAQ.');const m=visibleMessages().find(x=>x.id===b.dataset.id);if(!m)throw Error('Message not found.');
   faqEditor={question:'',answer:m.body,category:'help',owner:'Class teacher',scope:'class'};section='help';formOpen='';
  }else if(what==='faq-action'){section=b.dataset.tab==='contacts'?'help':b.dataset.tab;faqQuery='';faqCategory='all';}
  else if(what==='print-dismissal'){printDismissal();return;}
  fresh();
 }catch(err){error=err.message;fresh();}
}
function change(event){
 const el=event.target;const key=el?.dataset?.commSelect;if(!key)return;
 if(key==='student'){
  if(!people().some(s=>s.id===el.value))return;studentId=el.value;formOpen='';faqEditor=null;replyTo=null;error='';success='';fresh();
 }else if(key==='date'){if(/^\d{4}-\d{2}-\d{2}$/.test(el.value)){selectedDate=el.value;fresh();}}
 else if(key==='faq-category'){faqCategory=el.value;fresh();}
 else if(key==='audience'){composeKind=el.value;const f=el.closest('form');const recipient=f?.querySelector('[name="linkId"]')?.closest('div');if(recipient)recipient.classList.toggle('cm-hidden',composeKind!=='direct');const audience=f?.querySelector('.cm-audience');if(audience)audience.textContent=composeKind==='announcement'?`Class: ${meta.classroom.name} · ${(meta.links||[]).length} linked guardians`:'Private conversation with the selected guardian.';const submit=f?.querySelector('button[type="submit"]');if(submit)submit.textContent=composeKind==='announcement'?'Save fictional class message':'Save fictional private message';}
}
function input(event){if(event.target.id!=='cm-faq-search')return;faqQuery=event.target.value;const position=event.target.selectionStart;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{fresh();const field=document.getElementById('cm-faq-search');field?.focus();if(field&&position!==null)try{field.setSelectionRange(position,position);}catch{}},180);}
function printDismissal(){
 if(!teacher())throw Error('Only teacher mode can print the class list.');
 const root=document.getElementById('print-root');if(!root)throw Error('Print view is unavailable.');
 root.innerHTML=`<h1>Practice dismissal list</h1><p>${E(meta.classroom.name)} · ${E(prettyDate(selectedDate))}</p><p>FICTIONAL LOCAL PRACTICE — not an operational dismissal roster. Printed ${E(new Date().toLocaleString())}.</p><table class="cm-print-table"><thead><tr><th>Child</th><th>Recorded practice plan</th><th>Pending requests</th></tr></thead><tbody>${people().map(s=>`<tr><td>${E(s.display_name)}</td><td>${E(planLabel(model().getPlan(current,s.id,selectedDate)))}</td><td>${requests(s.id).filter(r=>(r.type==='dismissal'||(r.type==='attendance'&&r.details?.attendanceReason==='early'))&&r.date===selectedDate&&!terminal(r)).length}</td></tr>`).join('')}</tbody></table>`;
 document.body.classList.add('printing');global.print();
 setTimeout(()=>document.body.classList.remove('printing'),1000);
}
document.addEventListener('submit',submit,true);
document.addEventListener('click',click,true);
document.addEventListener('change',change,true);
document.addEventListener('input',input,true);
global.TeacherCommunication={render,open:tab=>{section=tab||'home';formOpen='';faqEditor=null;replyTo=null;},localDate};
})(typeof window!=='undefined'?window:globalThis);
