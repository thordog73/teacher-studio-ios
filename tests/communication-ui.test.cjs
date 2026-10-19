/* Handler-level integration checks. These use actual application scripts with a
 * deliberately small DOM/storage adapter; they do not claim browser layout,
 * native validation, focus, accessibility-tree, or mobile end-to-end coverage. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const KEY = 'teacherstudio_communication_v12:demo-class';
const TODAY = '2026-10-19';
const TOMORROW = '2026-10-20';
const clone = value => JSON.parse(JSON.stringify(value));
const decode = value => String(value || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrs = source => Object.fromEntries([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(m => [m[1], decode(m[2] || '')]));
const dataset = attributes => Object.fromEntries(Object.entries(attributes).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    writes: [],
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem(key, value) { data.set(key, String(value)); this.writes.push({ key, value: String(value) }); },
    removeItem: key => data.delete(key),
    clear: () => data.clear(),
  };
}

function element(values = {}) {
  const classes = new Set();
  const el = {
    id: '', dataset: {}, innerHTML: '', textContent: '', disabled: false,
    classList: {
      add: value => classes.add(value), remove: value => classes.delete(value),
      toggle(value, on) { if (on === undefined) on = !classes.has(value); on ? classes.add(value) : classes.delete(value); },
      contains: value => classes.has(value),
    },
    closest(selector) {
      if (selector === '[data-comm]' && this.dataset.comm) return this;
      if (selector === '[data-action]' && this.dataset.action) return this;
      if (selector === 'form') return this.form || (this.dataset.commForm ? this : null);
      return null;
    },
    ...values,
  };
  return el;
}

function formFromHTML(html, kind, match = {}, values = {}) {
  const found = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)].find(m => {
    const d = dataset(attrs(m[1]));
    return d.commForm === kind && Object.entries(match).every(([key, value]) => d[key] === value);
  });
  assert.ok(found, `Rendered ${kind} form is available: ${JSON.stringify(match)}`);
  const a = attrs(found[1]);
  const form = element({ id: a.id || '', dataset: dataset(a), _values: {}, elements: {} });
  for (const m of found[2].matchAll(/<input\b([^>]*)>/g)) {
    const f = attrs(m[1]);
    if (!f.name) continue;
    const checked = Object.hasOwn(f, 'checked');
    form.elements[f.name] = { checked };
    if (f.type !== 'checkbox' || checked) form._values[f.name] = f.value || (f.type === 'checkbox' ? 'on' : '');
  }
  for (const m of found[2].matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const f = attrs(m[1]);
    if (f.name) form._values[f.name] = decode(m[2]);
  }
  for (const m of found[2].matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const f = attrs(m[1]);
    const options = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(o => ({ ...attrs(o[1]), text: decode(o[2]) }));
    const chosen = options.find(o => Object.hasOwn(o, 'selected')) || options[0];
    if (f.name && chosen) form._values[f.name] = chosen.value ?? chosen.text;
  }
  Object.assign(form._values, values);
  for (const [key, value] of Object.entries(values)) if (typeof value === 'boolean') {
    form.elements[key] = { checked: value };
    if (value) form._values[key] = 'on'; else delete form._values[key];
  }
  const submitButton = element();
  const recipientContainer = element();
  const recipient = element({ closest: selector => selector === 'div' ? recipientContainer : null });
  const audience = element();
  form.querySelector = selector => selector === 'button[type="submit"]' ? submitButton : selector === '[name="linkId"]' ? recipient : selector === '.cm-audience' ? audience : null;
  return form;
}

function baseMeta(role = 'parent') {
  const classroom = { id: 'demo-class', teacher_id: 'demo-teacher', name: 'Test Classroom', grade: '5', share_grades: true, allow_parent_replies: true };
  const students = [
    { id: 'student-0', classroom_id: classroom.id, display_name: 'Child Alpha' },
    { id: 'student-1', classroom_id: classroom.id, display_name: 'Child Beta' },
    { id: 'student-2', classroom_id: classroom.id, display_name: 'Unlinked Child' },
  ];
  const links = [
    { id: 'link-a', classroom_id: classroom.id, student_id: 'student-0', guardian_id: 'demo-parent', guardian_email: 'alpha@example.test' },
    { id: 'link-b', classroom_id: classroom.id, student_id: 'student-1', guardian_id: 'demo-parent', guardian_email: 'beta@example.test' },
    { id: 'link-other-adult', classroom_id: classroom.id, student_id: 'student-0', guardian_id: 'other-parent', guardian_email: 'other@example.test' },
    { id: 'link-unlinked', classroom_id: classroom.id, student_id: 'student-2', guardian_id: 'unlinked-parent', guardian_email: 'unlinked@example.test' },
  ];
  const assignments = [
    { id: 'assignment-common', classroom_id: classroom.id, student_id: null, title: 'SHARED_LEARNING_TASK', instructions: 'Explain your approach.', due_date: TODAY },
    { id: 'assignment-pending', classroom_id: classroom.id, student_id: null, title: 'NO_RESULT_TASK', instructions: 'A separate task without a released result.', due_date: TOMORROW },
    { id: 'assignment-a', classroom_id: classroom.id, student_id: 'student-0', title: 'ALPHA_ONLY_TASK', instructions: 'Individual practice for Alpha.', due_date: TODAY },
    { id: 'assignment-b', classroom_id: classroom.id, student_id: 'student-1', title: 'BETA_ONLY_TASK', instructions: 'SIBLING_ASSIGNMENT_PRIVATE', due_date: TODAY },
    { id: 'assignment-unlinked', classroom_id: classroom.id, student_id: 'student-2', title: 'UNLINKED_ASSIGNMENT_PRIVATE', instructions: 'Unlinked work.', due_date: TODAY },
  ];
  const results = [
    { id: 'result-a', classroom_id: classroom.id, student_id: 'student-0', assignment_id: 'assignment-common', score: 8, max_score: 10, notes: 'OWN_RELEASED_RESULT', released_at: TODAY },
    { id: 'result-b', classroom_id: classroom.id, student_id: 'student-1', assignment_id: 'assignment-common', score: 1, max_score: 10, notes: 'SIBLING_RESULT_PRIVATE', released_at: TODAY },
    { id: 'result-draft', classroom_id: classroom.id, student_id: 'student-0', assignment_id: 'assignment-pending', score: 3, max_score: 10, notes: 'UNRELEASED_RESULT_PRIVATE', released_at: null },
  ];
  const message = (id, student_id, recipient_id, body, kind = 'direct') => ({ id, classroom_id: classroom.id, student_id, recipient_id, sender_id: 'demo-teacher', body, kind, created_at: TODAY + 'T09:00:00Z' });
  const messages = [
    message('notice-ack', null, null, 'CLASS_ANNOUNCEMENT_VISIBLE', 'announcement'),
    message('message-a', 'student-0', 'demo-parent', 'ALPHA_PRIVATE_CONVERSATION'),
    message('message-b', 'student-1', 'demo-parent', 'BETA_PRIVATE_CONVERSATION'),
    message('message-other-adult', 'student-0', 'other-parent', 'OTHER_GUARDIAN_PRIVATE'),
    message('message-unlinked', 'student-2', 'unlinked-parent', 'UNLINKED_PRIVATE_CONVERSATION'),
    { ...message('message-other-class', null, null, 'OTHER_CLASS_PRIVATE', 'announcement'), classroom_id: 'another-class' },
  ];
  return { role, mode: 'demo', loggedIn: true, classId: classroom.id, classroom, students, links, assignments, results, messages, guardianIds: ['student-0', 'student-1'], actorId: role === 'teacher' ? 'demo-teacher' : 'demo-parent', section: 'home', invitations: [] };
}

function harness({ role = 'parent', integrated = false, savedCloud = false } = {}) {
  const listeners = [];
  const localStorage = storage(savedCloud ? {
    teacherstudio_mode_v1: 'cloud',
    teacherstudio_cloudconfig_v1: JSON.stringify({ url: 'https://example.invalid', key: 'fictional-publishable-key' }),
  } : {});
  const sessionStorage = storage({ teacherstudio_onboard_intent: role, ...(savedCloud ? { teacherstudio_session_v1: JSON.stringify({ access_token: 'fictional-token', user: { id: 'fictional-cloud-user' } }) } : {}) });
  const nodes = { app: element(), toast: element(), 'print-root': element() };
  const document = {
    addEventListener: (type, fn, capture = false) => listeners.push({ type, fn, capture: !!capture }),
    getElementById: id => nodes[id] || null,
    querySelectorAll: () => [], body: element(),
  };
  const timers = new Map();
  let nextTimer = 1, cloudCalls = 0, serviceWorkerCalls = 0;
  const hub = {
    school: { name: 'Test School', phone: '', office: '' }, events: [],
    faqs: [
      { id: 'faq-absence', category: 'attendance', q: 'How do I report an absence?', a: 'Use the office process; a request is awaiting review.', action: 'attendance', owner: 'School office', scope: 'school', keywords: ['sick'] },
      { id: 'faq-contact', category: 'help', q: 'Which number should I call?', a: 'Check the school contacts.', action: 'contacts', owner: 'School office', scope: 'school', keywords: ['phone'] },
    ], saved: [],
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [TODAY + 'T12:00:00Z'])); }
    static now() { return Date.parse(TODAY + 'T12:00:00Z'); }
  }
  class FakeFormData {
    constructor(form) { assert.ok(form && form._values, 'Test FormData receives a rendered-form adapter'); this.values = new Map(Object.entries(form._values)); }
    entries() { return this.values.entries(); }
    get(key) { return this.values.get(key) ?? null; }
  }
  const window = {
    addEventListener() {}, print() {}, TeacherMath: { SKILLS: [] },
    TEACHER_STANDALONE_DEMO: true,
    TeacherCloud: class { constructor() { cloudCalls++; throw new Error('No cloud initialization is permitted in this standalone test.'); } },
    TeacherExtras: {
      ensureFamilyFAQs() {}, getFamilyInfo: () => hub,
      saveFamilyFAQ(value, meta) {
        if (meta.role !== 'teacher') throw new Error('Only a teacher can edit an FAQ.');
        const saved = { ...clone(value), id: value.id || 'hub-faq-new', q: value.question, a: value.answer };
        hub.faqs = hub.faqs.filter(f => f.id !== saved.id).concat(saved);
        hub.saved.push({ value: clone(saved), role: meta.role, classId: meta.classroom.id });
      },
      saveFamilySchool(value) { Object.assign(hub.school, value); },
      addFamilyEvent(value) { hub.events.push(clone(value)); },
    },
  };
  const context = vm.createContext({
    window, document, localStorage, sessionStorage, FormData: FakeFormData, Date: FixedDate,
    console, crypto: webcrypto, URL, Blob,
    navigator: { serviceWorker: { register() { serviceWorkerCalls++; throw new Error('No service worker in standalone test.'); } } },
    location: { protocol: 'file:', hostname: '' },
    setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    confirm: () => true,
    fetch: () => { throw new Error('These tests must not access a network.'); },
  });
  const load = filename => vm.runInContext(fs.readFileSync(path.join(ROOT, 'web', filename), 'utf8'), context, { filename });
  load('communication-model.js');
  load('communication.js');
  const env = { window, localStorage, sessionStorage, document, hub, meta: baseMeta(role), sent: [], get html() { return nodes.app.innerHTML; }, get cloudCalls() { return cloudCalls; }, get serviceWorkerCalls() { return serviceWorkerCalls; } };
  const teacherContext = { role: 'teacher', mode: 'demo', actorId: 'demo-teacher', guardianIds: env.meta.guardianIds, studentIds: env.meta.students.map(s => s.id), today: TODAY, now: TODAY + 'T12:00:00Z' };
  let initial = window.TeacherCommunicationModel.seed({ ...env.meta, classId: 'demo-class' }, TODAY);
  const seed = (type, payload) => { initial = window.TeacherCommunicationModel.dispatch(initial, { type, payload }, teacherContext); };
  seed('request.create', { type: 'call', studentId: 'student-0', date: TODAY, dueDate: TODAY, summary: 'TEACHER_ONLY_FOLLOWUP', details: { detail: 'TEACHER_ONLY_DETAIL' }, owner: 'teacher', visibleToFamily: false });
  seed('request.create', { type: 'call', studentId: 'student-1', date: TODAY, dueDate: TODAY, summary: 'BETA_FOLLOWUP_PRIVATE', details: {}, owner: 'family', visibleToFamily: true });
  seed('form.create', { title: 'ALL_CHILDREN_FORM', body: 'A separate response is needed for each child.', dueDate: TOMORROW, studentIds: [] });
  seed('form.create', { title: 'BETA_ONLY_FORM', body: 'This form is only assigned to Beta.', dueDate: TOMORROW, studentIds: ['student-1'] });
  seed('form.create', { title: 'UNLINKED_FORM_PRIVATE', body: 'This form is not assigned to this family.', dueDate: TOMORROW, studentIds: ['student-2'] });
  seed('message.meta', { messageId: 'notice-ack', requirement: 'ack', dueDate: TOMORROW, studentId: null });
  localStorage.setItem(KEY, JSON.stringify(initial));
  env.current = () => JSON.parse(localStorage.getItem(KEY));
  env.render = overrides => {
    if (overrides) Object.assign(env.meta, overrides);
    nodes.app.innerHTML = window.TeacherCommunication.render(env.meta);
    return env.html;
  };
  window.teacherStudioRender = () => env.render();
  env.meta.navigate = page => { env.navigation = page; };
  env.meta.sendMessage = async input => {
    const link = env.meta.links.find(l => l.id === input.linkId);
    const parent = env.meta.role === 'parent';
    const row = { id: 'saved-message-' + (env.sent.length + 1), classroom_id: env.meta.classroom.id, body: input.body, kind: parent ? 'direct' : input.kind, student_id: parent ? input.studentId : input.kind === 'direct' ? link.student_id : null, sender_id: env.meta.actorId, recipient_id: parent ? env.meta.classroom.teacher_id : input.kind === 'direct' ? link.guardian_id : null, created_at: TODAY + 'T12:00:00Z' };
    env.sent.push(clone(row)); env.meta.messages.push(row); return row;
  };
  env.fire = async (type, target) => {
    const event = { target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    for (const l of listeners.filter(l => l.type === type).sort((a, b) => Number(b.capture) - Number(a.capture))) {
      await l.fn(event);
      if (event.stopped) break;
    }
    return event;
  };
  env.click = async (comm, match = {}) => {
    const button = [...env.html.matchAll(/<button\b([^>]*)>/g)].map(m => attrs(m[1])).find(a => a['data-comm'] === comm && Object.entries(match).every(([key, value]) => dataset(a)[key] === value));
    assert.ok(button, `Rendered ${comm} action is available: ${JSON.stringify(match)}`);
    return env.fire('click', element({ dataset: dataset(button) }));
  };
  env.changeChild = async id => {
    assert.match(env.html, new RegExp('<option value="' + id + '"'));
    return env.fire('change', element({ dataset: { commSelect: 'student' }, value: id }));
  };
  env.changeAudience = async kind => {
    const form = formFromHTML(env.html, 'message');
    await env.fire('change', element({ dataset: { commSelect: 'audience' }, value: kind, form }));
    window.teacherStudioRender();
  };
  env.submit = async (kind, values = {}, match = {}) => {
    const form = formFromHTML(env.html, kind, match, values);
    const event = await env.fire('submit', form);
    assert.equal(event.defaultPrevented, true, 'A communication submit is handled without native navigation.');
    assert.equal(event.stopped, true, 'The main app must not also process this communication form.');
    assert.equal(form.querySelector('button[type="submit"]').disabled, false, 'The submit button is restored.');
    return event;
  };
  env.noError = () => assert.doesNotMatch(env.html, /class="cm-feedback cm-error"/, 'No communication error is rendered.');
  env.appData = () => JSON.parse(localStorage.getItem('teacherstudio_demo_v1'));
  env.appAction = async (action, extra = {}) => env.fire('click', element({ dataset: { action, ...extra } }));
  if (integrated) {
    const m = env.meta;
    localStorage.setItem('teacherstudio_demo_v1', JSON.stringify({ classrooms: [m.classroom], students: m.students, guardian_links: m.links, invitations: [], assignments: m.assignments, results: m.results, messages: m.messages, practice_attempts: [] }));
    load('family.js');
    load('app.js');
  } else env.render();
  return env;
}

test('home presents six useful actions and initially scopes details to the first linked child', async () => {
  const e = harness();
  const cards = [...e.html.matchAll(/<button\b([^>]*)>/g)].map(m => attrs(m[1])).filter(a => a.class === 'cm-tile');
  assert.deepEqual(cards.map(a => a['data-tab']), ['attendance', 'dismissal', 'learning', 'dates', 'messages', 'help']);
  assert.doesNotMatch(e.html, /Unlinked Child|BETA_FOLLOWUP_PRIVATE|TEACHER_ONLY_FOLLOWUP|TEACHER_ONLY_DETAIL/);
  for (const card of cards) {
    await e.click('tab', { tab: card['data-tab'] });
    e.noError();
    assert.match(e.html, /class="cm-breadcrumb"/);
    await e.click('tab', { tab: 'home' });
  }
});

test('parent messages exclude other children, other guardians, another class, and teacher-only follow-up', async () => {
  const e = harness();
  await e.click('tab', { tab: 'messages' });
  assert.match(e.html, /ALPHA_PRIVATE_CONVERSATION/);
  assert.match(e.html, /CLASS_ANNOUNCEMENT_VISIBLE/);
  assert.ok(!/BETA_PRIVATE_CONVERSATION|BETA_FOLLOWUP_PRIVATE|OTHER_GUARDIAN_PRIVATE|UNLINKED_PRIVATE_CONVERSATION|OTHER_CLASS_PRIVATE|TEACHER_ONLY_FOLLOWUP|TEACHER_ONLY_DETAIL/.test(e.html), 'The selected child’s messages and queue contain no other child, guardian, class, or teacher-only content.');
  await e.changeChild('student-1');
  assert.match(e.html, /BETA_PRIVATE_CONVERSATION/);
  assert.doesNotMatch(e.html, /ALPHA_PRIVATE_CONVERSATION|OTHER_GUARDIAN_PRIVATE/);
});

test('switching children clears a private reply and teacher FAQ editor state', async () => {
  const parent = harness();
  await parent.click('tab', { tab: 'messages' });
  await parent.click('reply', { id: 'message-a' });
  assert.match(parent.html, /class="cm-replying"/);
  await parent.changeChild('student-1');
  assert.doesNotMatch(parent.html, /class="cm-replying"|ALPHA_PRIVATE_CONVERSATION/);
  assert.match(parent.html, /name="studentId" value="student-1"/);
  const teacher = harness({ role: 'teacher' });
  await teacher.click('tab', { tab: 'messages' });
  await teacher.click('message-to-faq', { id: 'message-a' });
  assert.match(teacher.html, /class="cm-card cm-editor"/);
  await teacher.changeChild('student-1');
  assert.doesNotMatch(teacher.html, /class="cm-card cm-editor"/);
});

test('rendering and navigation leave queued calls and acknowledgment state unchanged', async () => {
  const e = harness({ role: 'teacher' });
  const before = e.localStorage.getItem(KEY);
  assert.match(e.html, /TEACHER_ONLY_FOLLOWUP/);
  assert.match(e.html, /cm-phone-needed/);
  e.window.teacherStudioRender();
  await e.click('tab', { tab: 'messages' });
  e.window.teacherStudioRender();
  await e.click('tab', { tab: 'home' });
  assert.equal(e.localStorage.getItem(KEY), before);
  assert.equal(e.current().requests.find(r => r.summary === 'TEACHER_ONLY_FOLLOWUP').status, 'call_needed');
});

test('teacher-created follow-up defaults to a private teacher-only note', async () => {
  const e = harness({ role: 'teacher' });
  await e.click('new-request', { type: 'call' });
  await e.submit('request', { summary: 'NEW_PRIVATE_TEACHER_NOTE', detail: 'Private preparation for a call.', owner: 'teacher', dueDate: TOMORROW, proposedTime: 'After class' }, { type: 'call' });
  e.noError();
  const saved = e.current().requests.find(r => r.summary === 'NEW_PRIVATE_TEACHER_NOTE');
  assert.equal(saved.visibleToFamily, false);
  assert.equal(saved.status, 'call_needed');
  e.render({ role: 'parent', actorId: 'demo-parent' });
  await e.click('tab', { tab: 'messages' });
  assert.doesNotMatch(e.html, /NEW_PRIVATE_TEACHER_NOTE|Private preparation for a call/);
});

test('acknowledgment requires an explicit click and is recorded only for the selected child', async () => {
  const e = harness();
  const before = e.localStorage.getItem(KEY);
  await e.click('tab', { tab: 'messages' });
  e.window.teacherStudioRender();
  assert.equal(e.localStorage.getItem(KEY), before, 'Viewing the announcement must not acknowledge it.');
  await e.click('ack', { id: 'notice-ack' });
  e.noError();
  const acknowledgments = e.current().messageMeta['notice-ack'].acknowledgments;
  assert.deepEqual(Object.keys(acknowledgments), ['student-0']);
  assert.equal(acknowledgments['student-0'].actorId, 'demo-parent');
  await e.changeChild('student-1');
  assert.match(e.html, /data-comm="ack" data-id="notice-ack"/);
  assert.equal(e.current().messageMeta['notice-ack'].acknowledgments['student-1'], undefined);
});

test('forms show the selected child and responses do not complete a sibling form', async () => {
  const e = harness();
  await e.click('tab', { tab: 'dates' });
  assert.match(e.html, /ALL_CHILDREN_FORM/);
  assert.doesNotMatch(e.html, /BETA_ONLY_FORM|UNLINKED_FORM_PRIVATE/);
  const common = e.current().forms.find(f => f.title === 'ALL_CHILDREN_FORM');
  await e.submit('form-response', { response: 'agreed' }, { id: common.id });
  e.noError();
  const saved = e.current().formResponses.filter(r => r.formId === common.id);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].studentId, 'student-0');
  assert.equal(saved[0].guardian, 'demo-parent');
  await e.changeChild('student-1');
  assert.match(e.html, /BETA_ONLY_FORM/);
  assert.ok(formFromHTML(e.html, 'form-response', { id: common.id }), 'The sibling still has their own unanswered class form.');
  const beta = e.current().forms.find(f => f.title === 'BETA_ONLY_FORM');
  const before = e.localStorage.getItem(KEY);
  await e.submit('form-response', { studentId: 'student-0', response: 'agreed' }, { id: beta.id });
  assert.match(e.html, /not assigned to that student/);
  assert.equal(e.localStorage.getItem(KEY), before, 'An invalid child/form combination does not save.');
});

test('learning shows released work for the selected child and never infers missing from an absent result', async () => {
  const e = harness();
  await e.click('tab', { tab: 'learning' });
  assert.match(e.html, /OWN_RELEASED_RESULT/);
  assert.doesNotMatch(e.html, /SIBLING_RESULT_PRIVATE|UNRELEASED_RESULT_PRIVATE|SIBLING_ASSIGNMENT_PRIVATE|UNLINKED_ASSIGNMENT_PRIVATE/);
  const ungraded = [...e.html.matchAll(/<article class="cm-assignment">([\s\S]*?)<\/article>/g)].find(m => m[1].includes('NO_RESULT_TASK'));
  assert.ok(ungraded);
  assert.match(ungraded[1], /Status not marked/);
  assert.match(ungraded[1], /does not mean the work is missing/);
  assert.doesNotMatch(ungraded[1], /Missing · marked by teacher/);
  e.render({ classroom: { ...e.meta.classroom, share_grades: false } });
  assert.doesNotMatch(e.html, /OWN_RELEASED_RESULT/);
  e.render({ classroom: { ...e.meta.classroom, share_grades: true } });
  await e.changeChild('student-1');
  assert.match(e.html, /SIBLING_RESULT_PRIVATE/);
  assert.doesNotMatch(e.html, /OWN_RELEASED_RESULT|UNRELEASED_RESULT_PRIVATE/);
});

test('FAQ actions navigate to useful controls without saving or submitting requests', async () => {
  const e = harness();
  await e.click('tab', { tab: 'help' });
  const before = e.localStorage.getItem(KEY);
  const event = await e.click('faq-action', { tab: 'attendance' });
  assert.equal(event.defaultPrevented, true);
  assert.match(e.html, /data-comm-form="attendance"/);
  assert.equal(e.localStorage.getItem(KEY), before);
  assert.equal(e.sent.length, 0);
  await e.click('tab', { tab: 'home' });
  await e.click('tab', { tab: 'help' });
  await e.click('faq-action', { tab: 'contacts' });
  assert.match(e.html, /id="cm-contacts"/);
  assert.equal(e.localStorage.getItem(KEY), before);
});

test('reviewed teacher FAQ writes to the existing School Hub adapter and appears on the next render', async () => {
  const e = harness({ role: 'teacher' });
  await e.click('tab', { tab: 'help' });
  await e.click('edit-faq', { id: '' });
  await e.submit('faq', { question: 'Where do library books go?', answer: 'Use the classroom book return basket.', category: 'dates', action: 'dates', owner: 'Class teacher', scope: 'class' });
  e.noError();
  assert.equal(e.hub.saved.length, 1);
  assert.equal(e.hub.saved[0].value.reviewedAt, TODAY);
  assert.equal(e.hub.saved[0].classId, 'demo-class');
  assert.equal(e.hub.saved[0].role, 'teacher');
  assert.match(e.html, /Where do library books go\?/);
  assert.match(e.html, /Use the classroom book return basket/);
  assert.doesNotMatch(e.html, /class="cm-card cm-editor"/);
  assert.equal(e.current().faqEdits.length, 0, 'There is no second, disconnected FAQ collection.');
});

test('a parent support request saves successfully using the composer’s default requested date', async () => {
  const e = harness();
  await e.click('tab', { tab: 'learning' });
  await e.click('new-request', { type: 'support' });
  await e.submit('request', { summary: 'Help with reading practice', detail: 'Which short activity should we start with?', proposedTime: 'After 4 pm' }, { type: 'support' });
  e.noError();
  const row = e.current().requests.find(r => r.summary === 'Help with reading practice');
  assert.ok(row, 'The actual handler reaches the model and persists the support request.');
  assert.equal(row.studentId, 'student-0');
  assert.equal(row.owner, 'teacher');
  assert.equal(row.status, 'pending');
  assert.equal(row.dueDate, TOMORROW, 'The requested follow-up date is preserved.');
});

test('actual app message handler distinguishes private recipients and class announcements', async () => {
  const e = harness({ role: 'teacher', integrated: true });
  await e.click('tab', { tab: 'messages' });
  await e.changeAudience('direct');
  await e.submit('message', { linkId: 'link-a', body: 'NEW_PRIVATE_MESSAGE', requirement: 'info' });
  e.noError();
  let saved = e.appData().messages.find(m => m.body === 'NEW_PRIVATE_MESSAGE');
  assert.equal(saved.kind, 'direct');
  assert.equal(saved.student_id, 'student-0');
  assert.equal(saved.recipient_id, 'demo-parent');
  await e.changeAudience('announcement');
  await e.submit('message', { body: 'NEW_CLASS_ANNOUNCEMENT', requirement: 'ack', dueDate: TOMORROW });
  e.noError();
  saved = e.appData().messages.find(m => m.body === 'NEW_CLASS_ANNOUNCEMENT');
  assert.equal(saved.kind, 'announcement');
  assert.equal(saved.student_id, null);
  assert.equal(saved.recipient_id, null);
  assert.equal(e.current().messageMeta[saved.id].requirement, 'ack');
  assert.deepEqual(e.current().messageMeta[saved.id].acknowledgments, {});
  const before = e.appData().messages.length;
  await e.submit('message', { body: 'INVALID_CLASS_CALLBACK', requirement: 'call', dueDate: TOMORROW });
  assert.match(e.html, /select one private guardian/);
  assert.equal(e.appData().messages.length, before, 'Invalid whole-class callback is rejected before message persistence.');
});

test('a parent announcement reply stays private and a reply request creates its follow-up', async () => {
  const e = harness({ integrated: true });
  await e.click('tab', { tab: 'messages' });
  await e.click('reply', { id: 'notice-ack' });
  await e.submit('message', { body: 'PARENT_PRIVATE_RESPONSE', requirement: 'reply', dueDate: TOMORROW, kind: 'announcement' });
  e.noError();
  const saved = e.appData().messages.find(m => m.body === 'PARENT_PRIVATE_RESPONSE');
  assert.equal(saved.kind, 'direct', 'A parent cannot broadcast by supplying an announcement field.');
  assert.equal(saved.student_id, 'student-0');
  assert.equal(saved.recipient_id, 'demo-teacher');
  const followup = e.current().requests.find(r => r.details.messageId === saved.id);
  assert.ok(followup, 'The message and its requested follow-up are both saved.');
  assert.equal(followup.type, 'support');
  assert.equal(followup.owner, 'teacher');
  assert.doesNotMatch(e.html, /class="cm-replying"/);
});

test('private callback content stays with its selected guardian even when another guardian shares the child', async () => {
  const e = harness({ role: 'teacher', integrated: true });
  await e.click('tab', { tab: 'messages' });
  await e.changeAudience('direct');
  await e.submit('message', { linkId: 'link-other-adult', body: 'CALLBACK_FOR_OTHER_GUARDIAN_ONLY', requirement: 'call', dueDate: TOMORROW });
  e.noError();
  const saved = e.appData().messages.find(m => m.body === 'CALLBACK_FOR_OTHER_GUARDIAN_ONLY');
  assert.equal(saved.recipient_id, 'other-parent');
  const followup = e.current().requests.find(r => r.details.messageId === saved.id);
  assert.ok(followup);
  assert.equal(followup.recipientActorId, 'other-parent');
  await e.appAction('role', { role: 'parent' });
  assert.ok(!e.html.includes('CALLBACK_FOR_OTHER_GUARDIAN_ONLY'), 'The home summary does not expose another guardian’s private callback.');
  await e.click('tab', { tab: 'messages' });
  assert.ok(!e.html.includes('CALLBACK_FOR_OTHER_GUARDIAN_ONLY'), 'The message list and follow-up queue preserve the specific guardian audience.');
});

test('an explicit family reply returns the original reply request to the teacher without completing a phone call', async () => {
  const e = harness({ role: 'teacher', integrated: true });
  await e.click('tab', { tab: 'messages' });
  await e.changeAudience('direct');
  await e.submit('message', { linkId: 'link-a', body: 'PLEASE_REPLY_ABOUT_READING', requirement: 'reply', dueDate: TOMORROW });
  e.noError();
  const original = e.appData().messages.find(m => m.body === 'PLEASE_REPLY_ABOUT_READING');
  const requestId = e.current().requests.find(r => r.details.messageId === original.id).id;
  await e.submit('message', { linkId: 'link-a', body: 'SEPARATE_PHONE_CALL_REQUEST', requirement: 'call', dueDate: TOMORROW });
  e.noError();
  const callMessage = e.appData().messages.find(m => m.body === 'SEPARATE_PHONE_CALL_REQUEST');
  const callId = e.current().requests.find(r => r.details.messageId === callMessage.id).id;
  const requestCount = e.current().requests.length;
  await e.appAction('role', { role: 'parent' });
  await e.click('tab', { tab: 'messages' });
  await e.click('reply', { id: original.id });
  await e.submit('message', { body: 'OUR_READING_RESPONSE', requirement: 'info' });
  e.noError();
  const replyMessage = e.appData().messages.find(m => m.body === 'OUR_READING_RESPONSE');
  const answered = e.current().requests.find(r => r.id === requestId);
  assert.equal(answered.owner, 'teacher');
  assert.equal(answered.status, 'follow_up');
  assert.equal(answered.reply.messageId, replyMessage.id);
  assert.equal(answered.reply.actorId, 'demo-parent');
  assert.equal(e.current().requests.length, requestCount, 'Replying updates the existing task rather than duplicating it.');
  await e.click('reply', { id: callMessage.id });
  await e.submit('message', { body: 'I_CAN_CALL_LATER', requirement: 'info' });
  e.noError();
  const stillNeedsCall = e.current().requests.find(r => r.id === callId);
  assert.equal(stillNeedsCall.owner, 'family');
  assert.equal(stillNeedsCall.status, 'call_needed');
  assert.equal(stillNeedsCall.reachedAt, undefined, 'A written message is not evidence that the phone conversation happened.');
});

test('a student added through the retained classroom form can immediately receive a new follow-up', async () => {
  const e = harness({ role: 'teacher', integrated: true });
  const originalIds = e.current().requests.map(r => r.id);
  await e.appAction('nav', { page: 'classroom' });
  assert.match(e.html, /id="student-form"/);
  const event = await e.fire('submit', element({ id: 'student-form', _values: { name: 'Newly Joined Student' } }));
  assert.equal(event.defaultPrevented, true);
  const added = e.appData().students.find(s => s.display_name === 'Newly Joined Student');
  assert.ok(added, 'The existing app student form creates the child.');
  await e.appAction('nav', { page: 'today' });
  assert.ok(e.current().studentIds.includes(added.id), 'The communication model reconciles its roster on the next render.');
  await e.changeChild(added.id);
  await e.click('new-request', { type: 'call' });
  await e.submit('request', { summary: 'WELCOME_NEW_FAMILY_CALL', detail: 'A fictional welcome follow-up.', owner: 'teacher', dueDate: TOMORROW }, { type: 'call' });
  e.noError();
  const saved = e.current().requests.find(r => r.summary === 'WELCOME_NEW_FAMILY_CALL');
  assert.equal(saved.studentId, added.id);
  assert.ok(originalIds.every(id => e.current().requests.some(r => r.id === id)), 'Reconciling the roster preserves the existing request history.');
});

test('early pickup is one dated request and changes the plan only after explicit verified practice confirmation', async () => {
  const e = harness({ integrated: true });
  const model = e.window.TeacherCommunicationModel;
  const originalCount = e.current().requests.length;
  assert.equal(model.getPlan(e.current(), 'student-0', TODAY).method, 'bus');
  await e.click('tab', { tab: 'attendance' });
  await e.submit('attendance', { attendanceReason: 'early', date: TODAY, earlyTime: '13:30', adult: 'Fictional Caregiver', detail: 'Fictional appointment.' });
  e.noError();
  let request = e.current().requests.find(r => r.type === 'attendance' && r.details.attendanceReason === 'early');
  assert.ok(request);
  assert.equal(e.current().requests.length, originalCount + 1, 'Early pickup creates one request rather than independent competing records.');
  assert.equal(request.status, 'pending');
  assert.equal(model.getPlan(e.current(), 'student-0', TODAY).method, 'bus', 'A parent request does not change the existing arrangement.');
  await e.appAction('role', { role: 'teacher' });
  await e.click('tab', { tab: 'attendance' });
  const before = e.localStorage.getItem(KEY);
  await e.submit('status', { status: 'confirmed', owner: 'office', note: 'Review requested.', verified: false }, { id: request.id });
  assert.ok(/class="cm-feedback cm-error"/.test(e.html), 'The handler requires the school verification step in this practice workflow.');
  assert.equal(e.localStorage.getItem(KEY), before);
  await e.submit('status', { status: 'confirmed', owner: 'office', note: 'Practice authorization and identity check recorded.', verified: true }, { id: request.id });
  e.noError();
  request = e.current().requests.find(r => r.id === request.id);
  assert.equal(request.status, 'confirmed');
  assert.equal(e.current().requests.length, originalCount + 1);
  const confirmed = model.getPlan(e.current(), 'student-0', TODAY);
  assert.equal(confirmed.method, 'pickup');
  assert.equal(confirmed.adult, 'Fictional Caregiver');
  assert.equal(confirmed.requestId, request.id);
  assert.equal(model.getPlan(e.current(), 'student-0', TOMORROW).method, 'bus', 'The dated exception does not overwrite tomorrow’s usual plan.');
});

test('standalone app starts on Today, retains Family setup, and ignores saved cloud configuration', async () => {
  const e = harness({ role: 'teacher', integrated: true, savedCloud: true });
  assert.match(e.html, /<h1>Today &amp; families<\/h1>/);
  assert.match(e.html, /id="communication-desk"/);
  assert.match(e.html, /Fictional-data demo/);
  assert.match(e.html, /DEMO · Local only/);
  assert.doesNotMatch(e.html, />Cloud mode<\/span>/);
  assert.equal(e.cloudCalls, 0);
  assert.equal(e.serviceWorkerCalls, 0);
  await e.appAction('nav', { page: 'family' });
  assert.match(e.html, /id="family-homework-form"/);
  assert.match(e.html, /id="family-announcement-form"/);
  await e.appAction('nav', { page: 'today' });
  assert.match(e.html, /id="communication-desk"/);
  await e.appAction('role', { role: 'parent' });
  assert.match(e.html, /<h1>Today &amp; families<\/h1>/);
  assert.doesNotMatch(e.html, /TEACHER_ONLY_FOLLOWUP/);
  assert.equal(e.cloudCalls, 0);
});
