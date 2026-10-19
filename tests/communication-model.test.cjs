const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../web/communication-model.js');

const today = '2026-10-19';
const meta = { classId: 'demo-class', mode: 'demo', role: 'teacher', actorId: 'demo-teacher', students: [{ id: 'student-a', display_name: 'Fictional A' }, { id: 'student-b', display_name: 'Fictional B' }], guardianIds: ['student-a'] };
const teacher = { role: 'teacher', mode: 'demo', actorId: 'demo-teacher', studentIds: ['student-a', 'student-b'], guardianIds: ['student-a'], today, now: today + 'T14:00:00+02:00' };
const parent = { ...teacher, role: 'parent', actorId: 'demo-parent', guardianIds: ['student-a'] };
const otherParent = { ...parent, actorId: 'other-parent' };
const clone = value => JSON.parse(JSON.stringify(value));
const dispatch = (state, type, payload, ctx = teacher) => M.dispatch(state, { type, payload }, ctx);
const seeded = () => M.seed(meta, today);
const blank = () => M.seed({ ...meta, guardianIds: [] }, today);
const last = collection => collection[collection.length - 1];
const req = (state, payload = {}, ctx = parent) => dispatch(state, 'request.create', { type: 'support', studentId: 'student-a', summary: 'Fictional help request', details: {}, ...payload }, ctx);
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

test('exports the same dependency-free API to browsers and CommonJS', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/communication-model.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.window.TeacherCommunicationModel.dispatch, 'function');
  assert.equal(sandbox.window.TeacherCommunicationModel.VERSION, 12);
  assert.equal(M.VERSION, 12);
});

test('demo seeds use the first linked child and the supplied calendar date', () => {
  const state = M.seed({ ...meta, guardianIds: ['student-b'] }, '2026-12-31');
  assert.equal(state.requests.length, 2);
  assert.equal(state.requests[0].type, 'attendance');
  assert.equal(state.requests[0].status, 'pending');
  assert.equal(state.requests[0].owner, 'office');
  assert.equal(state.requests[1].status, 'call_needed');
  assert.equal(state.requests[1].owner, 'family');
  assert.equal(state.requests[1].visibleToFamily, true);
  assert.ok(state.requests.every(row => row.studentId === 'student-b' && row.date === '2026-12-31' && row.practice));
  assert.ok(state.dismissalPlans.every(row => row.studentId === 'student-b' && /Bus 12.*fictional/.test(row.detail) && row.practice));
  assert.equal(state.forms[0].dueDate, '2027-01-01');
  assert.equal(state.settings.schoolPhone, '');
  assert.equal(state.settings.dismissalCutoff, '');
  assert.equal(M.getPlan(state, 'student-a', '2026-12-31').source, 'none');
  assert.equal(M.seed(meta, '2024-02-28').forms[0].dueDate, '2024-02-29');
  assert.equal(M.localDate('2026-10-19'), '2026-10-19');
});

test('connected mode has no fictional workflow records and cannot mutate', () => {
  const cloud = M.seed({ ...meta, mode: 'cloud' }, today);
  for (const key of ['requests', 'dismissalPlans', 'forms', 'formResponses', 'history', 'faqEdits']) assert.deepEqual(cloud[key], []);
  assert.deepEqual(cloud.learning, {});
  assert.throws(() => req(cloud), /practice mode/);
  assert.throws(() => req(seeded(), {}, { ...parent, mode: 'cloud' }), /practice mode/);
  assert.throws(() => req(seeded(), {}, { ...parent, role: 'administrator' }), /role/);
});

test('both parent linkage and the current classroom roster bound mutations', () => {
  const state = freeze(blank());
  const before = clone(state);
  assert.throws(() => req(state, { studentId: 'student-b' }), /Student is not available/);
  assert.throws(() => req(state, { studentId: 'unknown-child' }, teacher), /Student is not available/);
  assert.throws(() => req(state, { studentId: 'student-b' }, { ...teacher, studentIds: ['student-a'] }), /Student is not available/);
  assert.throws(() => req(state, {}, { ...teacher, classId: 'another-class' }), /outside this context/);
  assert.throws(() => req(state, {}, { ...teacher, studentIds: undefined }), /context students/);
  assert.deepEqual(state, before);
});

test('family visibility does not expose teacher notes or another guardian private request', () => {
  let state = req(blank(), { summary: 'PRIVATE TO FIRST GUARDIAN' });
  state = req(state, { type: 'call', summary: 'TEACHER ONLY CALLBACK', visibleToFamily: false }, teacher);
  state = req(state, { type: 'call', summary: 'DELIBERATE FAMILY CONTACT', visibleToFamily: true, owner: 'family' }, teacher);
  state = req(state, { studentId: 'student-b', summary: 'OTHER CHILD' }, teacher);
  const family = M.getVisibleRequests(state, parent);
  assert.equal(family.length, 2);
  assert.ok(family.every(row => !['TEACHER ONLY CALLBACK', 'OTHER CHILD'].includes(row.summary)));
  assert.deepEqual(M.getVisibleRequests(state, otherParent).map(row => row.summary), ['DELIBERATE FAMILY CONTACT']);
  assert.equal(M.getVisibleRequests(state, teacher).length, 4);
  assert.deepEqual(M.getVisibleRequests(state, parent, 'student-b'), []);
  assert.equal(M.getVisibleRequests(state, { ...teacher, studentIds: ['student-a'] }).length, 3);
  const corrupted = clone(state);
  corrupted.requests.push({ ...corrupted.requests[0], id: 'foreign-request', classId: 'foreign-class' });
  assert.equal(M.getVisibleRequests(corrupted, teacher).length, 4);
});

test('pending dismissal changes do not change today, another date, or a default plan', () => {
  const original = seeded();
  const state = req(original, { type: 'dismissal', date: '2026-10-20', summary: 'Practice one-day pickup', details: { method: 'pickup', adult: 'Fictional Aunt', detail: 'Sample entrance' }, owner: 'office' });
  assert.equal(M.getPlan(state, 'student-a', today).method, 'bus');
  assert.equal(M.getPlan(state, 'student-a', '2026-10-20').method, 'bus');
  assert.deepEqual(state.dismissalPlans, original.dismissalPlans);
  const id = last(state.requests).id;
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'confirmed' }), /required school-authorized/);
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'confirmed', verifiedRoute: true }), /required school-authorized/);
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'confirmed', verifiedAuthorizedAdult: 'true' }), /true or false/);
  const confirmed = dispatch(state, 'request.status', { id, status: 'confirmed', verifiedAuthorizedAdult: true });
  assert.equal(M.getPlan(confirmed, 'student-a', '2026-10-20').method, 'pickup');
  assert.equal(M.getPlan(confirmed, 'student-a', '2026-10-20').adult, 'Fictional Aunt');
  assert.equal(M.getPlan(confirmed, 'student-a', '2026-10-20').source, 'request');
  assert.equal(M.getPlan(confirmed, 'student-a', today).method, 'bus');
  assert.equal(M.getPlan(confirmed, 'student-a', '2026-10-27').method, 'bus');
  assert.throws(() => M.getPlan(confirmed, 'unknown-child', today), /not available/);
  assert.throws(() => M.getPlan(confirmed, 'student-b', today, parent), /not available/);
});

test('all non-pickup methods require route verification before practice confirmation', () => {
  for (const method of ['bus', 'daycare', 'walk', 'activity', 'other']) {
    const state = req(seeded(), { type: 'dismissal', date: today, details: { method, detail: 'Fictional route' }, owner: 'office' });
    const id = last(state.requests).id;
    assert.throws(() => dispatch(state, 'request.status', { id, status: 'confirmed', verifiedAuthorizedAdult: true }), /required school-authorized/);
    const next = dispatch(state, 'request.status', { id, status: 'confirmed', verifiedRoute: true });
    assert.equal(M.getPlan(next, 'student-a', today).method, method);
    assert.equal(last(next.requests).confirmation.practice, true);
  }
});

test('latest confirmation wins even when an older request is confirmed last with the same clock timestamp', () => {
  let state = req(seeded(), { type: 'dismissal', date: today, details: { method: 'pickup', adult: 'Fictional Adult A' } });
  const firstId = last(state.requests).id;
  state = req(state, { type: 'dismissal', date: today, details: { method: 'pickup', adult: 'Fictional Adult B' } });
  const secondId = last(state.requests).id;
  state = dispatch(state, 'request.status', { id: secondId, status: 'confirmed', verifiedAuthorizedAdult: true });
  state = dispatch(state, 'request.status', { id: firstId, status: 'confirmed', verifiedAuthorizedAdult: true });
  assert.equal(M.getPlan(state, 'student-a', today).requestId, firstId);
  state = dispatch(state, 'request.status', { id: firstId, status: 'resolved' });
  assert.equal(M.getPlan(state, 'student-a', today).requestId, firstId);
  let cancellable = req(seeded(), { type: 'dismissal', date: today, details: { method: 'pickup', adult: 'Fictional Adult' } });
  const cancelId = last(cancellable.requests).id;
  cancellable = dispatch(cancellable, 'request.status', { id: cancelId, status: 'confirmed', verifiedAuthorizedAdult: true });
  cancellable = dispatch(cancellable, 'request.status', { id: cancelId, status: 'cancelled' });
  assert.equal(M.getPlan(cancellable, 'student-a', today).source, 'default');
});

test('only the author can cancel a pending parent request; parents cannot confirm, hide, or assign family actions', () => {
  const state = req(blank());
  const id = last(state.requests).id;
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'confirmed' }, parent), /only cancel/);
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'cancelled' }, otherParent), /only cancel/);
  assert.equal(last(dispatch(state, 'request.status', { id, status: 'cancelled' }, parent).requests).status, 'cancelled');
  const reviewed = dispatch(state, 'request.status', { id, status: 'reviewed' });
  assert.throws(() => dispatch(reviewed, 'request.status', { id, status: 'cancelled' }, parent), /only cancel/);
  assert.throws(() => req(blank(), { visibleToFamily: false }), /must remain visible/);
  assert.throws(() => req(blank(), { owner: 'family' }), /school role/);
  assert.throws(() => req(blank(), { status: 'confirmed' }), /Unknown request field/);
});

test('attempted calls, voicemail, reached, and follow-up stay open; reading never completes a request', () => {
  let state = seeded();
  const id = state.requests.find(row => row.type === 'call').id;
  assert.equal(M.getQueue(state, parent, 'action').find(row => row.id === id).status, 'call_needed');
  for (const status of ['attempted', 'voicemail', 'follow_up']) {
    state = dispatch(state, 'request.status', { id, status });
    assert.ok(M.getQueue(state, parent, 'action').some(row => row.id === id));
    assert.ok(!M.getQueue(state, parent, 'completed').some(row => row.id === id));
    assert.throws(() => dispatch(state, 'request.status', { id, status: 'resolved' }), /successful contact/);
  }
  const beforeRead = clone(state);
  M.getVisibleRequests(state, parent);
  M.getQueue(state, teacher, 'waiting');
  assert.deepEqual(state, beforeRead);
  assert.throws(() => dispatch(state, 'request.read', { id }), /Unknown communication action/);
  state = dispatch(state, 'request.status', { id, status: 'reached', owner: 'teacher' });
  assert.ok(M.getQueue(state, teacher, 'action').some(row => row.id === id));
  assert.ok(M.getQueue(state, parent, 'waiting').some(row => row.id === id));
  state = dispatch(state, 'request.status', { id, status: 'resolved' });
  assert.ok(M.getQueue(state, parent, 'completed').some(row => row.id === id));
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'call_needed' }), /closed/);
});

test('queues respect ownership and keep office requests in waiting', () => {
  let state = seeded();
  state = req(state, { summary: 'Teacher follow-up' });
  assert.equal(M.getQueue(state, teacher, 'action').length, 1);
  assert.equal(M.getQueue(state, teacher, 'waiting').length, 2);
  assert.equal(M.getQueue(state, parent, 'action').length, 1);
  assert.equal(M.getQueue(state, parent, 'waiting').length, 2);
  assert.equal(M.getQueue(state, parent, 'completed').length, 0);
  assert.throws(() => M.getQueue(state, parent, 'unread'), /queue filter/);
});

test('form responses require assignment, student ownership, and the actual guardian actor', () => {
  let state = dispatch(blank(), 'form.create', { title: 'Sample permission', dueDate: '2026-10-20', body: 'Practice consent only.', studentIds: ['student-a'] });
  const formId = last(state.forms).id;
  assert.throws(() => dispatch(state, 'form.respond', { formId, studentId: 'student-a', response: 'agreed' }), /Only a linked parent/);
  assert.throws(() => dispatch(state, 'form.respond', { formId, studentId: 'student-b', response: 'agreed' }, parent), /Student is not available/);
  assert.throws(() => dispatch(state, 'form.respond', { formId, studentId: 'student-a', response: 'agreed', guardian: 'someone-else' }, parent), /must match/);
  assert.throws(() => dispatch(state, 'form.respond', { formId: 'unknown-form', studentId: 'student-a', response: 'agreed' }, parent), /Record is not available/);
  const parentB = { ...parent, guardianIds: ['student-b'] };
  assert.throws(() => dispatch(state, 'form.respond', { formId, studentId: 'student-b', response: 'agreed' }, parentB), /not assigned/);
  state = dispatch(state, 'form.respond', { formId, studentId: 'student-a', response: 'agreed', guardian: parent.actorId }, parent);
  state = dispatch(state, 'form.respond', { formId, studentId: 'student-a', response: 'declined' }, parent);
  state = dispatch(state, 'form.respond', { formId, studentId: 'student-a', response: 'agreed' }, otherParent);
  assert.equal(state.formResponses.length, 2);
  assert.equal(state.formResponses.find(row => row.guardian === parent.actorId).response, 'declined');
  assert.throws(() => dispatch(state, 'form.create', { title: 'All students', dueDate: '', body: 'Sample', studentIds: [] }, { ...teacher, studentIds: ['student-a'] }), /whole classroom roster/);
});

test('message acknowledgment is per student and does not complete a required reply or call', () => {
  let state = seeded();
  state = dispatch(state, 'message.meta', { messageId: 'message-a', requirement: 'ack', dueDate: today, studentId: 'student-a' });
  const requestsBefore = clone(state.requests);
  state = dispatch(state, 'message.ack', { messageId: 'message-a', studentId: 'student-a' }, parent);
  assert.equal(state.messageMeta['message-a'].acknowledgments['student-a'].actorId, parent.actorId);
  assert.deepEqual(state.requests, requestsBefore);
  assert.throws(() => dispatch(state, 'message.ack', { messageId: 'message-a', studentId: 'student-b' }, { ...parent, guardianIds: ['student-b'] }), /not available for that student/);
  assert.throws(() => dispatch(state, 'message.ack', { messageId: 'unknown-message', studentId: 'student-a' }, parent), /not available/);
  state = dispatch(state, 'message.meta', { messageId: 'message-a', requirement: 'call', dueDate: today, studentId: 'student-a' });
  assert.deepEqual(state.messageMeta['message-a'].acknowledgments, {});
  assert.throws(() => dispatch(state, 'message.ack', { messageId: 'message-a', studentId: 'student-a' }, parent), /cannot complete/);
  state = dispatch(state, 'message.meta', { messageId: 'message-a', requirement: 'reply', dueDate: today, studentId: 'student-a' });
  assert.throws(() => dispatch(state, 'message.ack', { messageId: 'message-a', studentId: 'student-a' }, parent), /cannot complete/);
});

test('preferences remain separate for two guardians of one child and a teacher', () => {
  let state = dispatch(blank(), 'preference.save', { studentId: 'student-a', fields: { language: 'Italian', phone: 'fictional-phone-A', callbackWindow: 'After school' } }, parent);
  state = dispatch(state, 'preference.save', { studentId: 'student-a', fields: { language: 'English', phone: 'fictional-phone-B' } }, otherParent);
  state = dispatch(state, 'preference.save', { studentId: 'student-a', fields: { contactMethod: 'School-approved channel' } }, teacher);
  assert.equal(Object.keys(state.preferences['student-a']).length, 3);
  assert.equal(M.getPreferences(state, parent, 'student-a')[parent.actorId].phone, 'fictional-phone-A');
  assert.deepEqual(Object.keys(M.getPreferences(state, parent, 'student-a')), [parent.actorId]);
  assert.deepEqual(Object.keys(M.getPreferences(state, otherParent, 'student-a')), [otherParent.actorId]);
  assert.equal(Object.keys(M.getPreferences(state, teacher, 'student-a')).length, 3);
  assert.throws(() => M.getPreferences(state, parent, 'student-b'), /not available/);
  assert.throws(() => dispatch(state, 'preference.save', { studentId: 'student-a', fields: { guardian: 'another-person' } }, parent), /Unknown preference field/);
});

test('learning metadata is teacher-owned, scoped, and absent unless deliberately set', () => {
  let state = blank();
  assert.deepEqual(M.getLearning(state, parent, 'student-a'), {});
  state = dispatch(state, 'learning.save', { studentId: 'student-a', assignmentId: 'assignment-a', status: 'missing', practiceNote: 'Fictional next step' });
  assert.equal(M.getLearning(state, parent, 'student-a')['assignment-a'].status, 'missing');
  assert.throws(() => dispatch(state, 'learning.save', { studentId: 'student-a', assignmentId: 'assignment-a', status: 'complete' }, parent), /Only a classroom teacher/);
  assert.throws(() => dispatch(state, 'learning.save', { studentId: 'student-b', assignmentId: 'assignment-a', status: 'complete' }, { ...teacher, studentIds: ['student-a'] }), /not available/);
  assert.throws(() => dispatch(state, 'learning.save', { studentId: 'student-a', assignmentId: 'assignment-a', status: 'complete' }, { ...teacher, assignmentIds: ['assignment-b'] }), /Assignment is not available/);
  const sample = M.seed({ ...meta, assignments: [{ id: 'sample-1', classroom_id: 'demo-class' }, { id: 'sample-2', classroom_id: 'demo-class' }] }, today);
  assert.equal(sample.learning['student-a']['sample-2'].status, 'missing');
  assert.deepEqual(M.seed({ ...meta, assignments: [{ id: 'sample-1', classroom_id: 'demo-class' }, { id: 'real-assignment', classroom_id: 'demo-class' }] }, today).learning, {});
  assert.deepEqual(M.seed({ ...meta, assignments: [{ id: 'sample-1', classroom_id: 'demo-class' }, { id: 'sample-2', classroom_id: 'demo-class', student_id: 'student-b' }] }, today).learning, {});
});

test('settings, FAQs, dates, and details reject invalid values and undeclared fields', () => {
  const state = freeze(blank());
  assert.throws(() => dispatch(state, 'settings.save', { schoolPhone: 'fictional phone' }, parent), /Only a classroom teacher/);
  assert.throws(() => dispatch(state, 'settings.save', { dismissalCutoff: '25:30' }), /HH:MM/);
  assert.throws(() => dispatch(state, 'settings.save', { secretPin: '1234' }), /Unknown settings field/);
  const settings = dispatch(state, 'settings.save', { schoolPhone: '', teacherPhone: '', dismissalCutoff: '14:15', responseWindow: 'School-configured response arrangements' });
  assert.equal(settings.settings.dismissalCutoff, '14:15');
  for (const badDate of ['2026-02-29', '2026-10-32', '19/10/2026', '2026-10-19T12:00:00Z']) assert.throws(() => req(state, { type: 'attendance', date: badDate }), /Invalid request date/);
  assert.throws(() => req(state, {}, { ...parent, now: '2026-02-30T12:00:00Z' }), /Invalid timestamp date/);
  assert.throws(() => req(state, { type: 'attendance' }), /Invalid request date/);
  assert.throws(() => req(state, { type: 'dismissal', date: today, details: { method: 'pickup', adult: 'Sample adult', pickupPassword: '1234' } }), /Unknown request details/);
  assert.throws(() => req(state, { summary: 'x'.repeat(1501) }), /Invalid request summary/);
  assert.throws(() => req(state, { details: { detail: { unexpected: true } } }), /must be text/);
  assert.throws(() => dispatch(state, 'faq.save', { id: 'faq-one', question: 'Sample?', answer: 'Sample answer' }, parent), /Only a classroom teacher/);
  const faq = dispatch(state, 'faq.save', { id: 'faq-one', question: 'Sample?', answer: 'Sample answer', category: 'Attendance', owner: 'office', reviewDate: today });
  assert.equal(faq.faqEdits.length, 1);
  assert.equal(dispatch(faq, 'faq.save', { id: 'faq-one', question: 'Updated?', answer: 'Updated sample answer' }).faqEdits.length, 1);
  assert.throws(() => dispatch(state, 'preference.save', { studentId: 'student-a', fields: JSON.parse('{"__proto__":{"polluted":true}}') }, parent), /Unknown preference field/);
  assert.throws(() => dispatch(state, 'message.meta', { messageId: 'constructor', requirement: 'info', dueDate: '', studentId: null }), /Invalid message ID/);
  assert.equal({}.polluted, undefined);
});

test('every mutation and selector preserves input state and isolates returned objects', () => {
  const state = freeze(seeded());
  const before = clone(state);
  const payload = { type: 'support', studentId: 'student-a', summary: 'Sample support', details: { detail: 'Original detail' } };
  const next = dispatch(state, 'request.create', payload, parent);
  payload.details.detail = 'Changed caller input';
  assert.deepEqual(state, before);
  assert.equal(last(next.requests).details.detail, 'Original detail');
  const visible = M.getVisibleRequests(next, parent);
  last(visible).details.detail = 'Changed returned view';
  assert.equal(last(next.requests).details.detail, 'Original detail');
  const plan = M.getPlan(next, 'student-a', today);
  plan.detail = 'Changed returned plan';
  assert.match(M.getPlan(next, 'student-a', today).detail, /fictional/);
  assert.notEqual(next.requests, state.requests);
});

test('history captures explicit transitions and status choices match meaningful call and dismissal states', () => {
  let state = seeded();
  const callback = state.requests.find(row => row.type === 'call');
  assert.ok(!M.allowedStatuses(callback).includes('resolved'));
  assert.ok(!M.allowedStatuses(callback).includes('confirmed'));
  state = dispatch(state, 'request.status', { id: callback.id, status: 'attempted', note: 'Fictional attempt' });
  state = dispatch(state, 'request.status', { id: callback.id, status: 'reached' });
  const reached = state.requests.find(row => row.id === callback.id);
  assert.ok(M.allowedStatuses(reached).includes('resolved'));
  const history = state.history.filter(row => row.recordId === callback.id);
  assert.deepEqual(history.map(row => [row.from, row.to]), [['call_needed', 'attempted'], ['attempted', 'reached']]);
  assert.ok(history.every(row => row.practice === true && row.actorId === teacher.actorId && row.at === teacher.now));
  assert.ok(history[1].sequence > history[0].sequence);
  const pending = state.requests.find(row => row.type === 'attendance');
  assert.ok(!M.allowedStatuses(pending).includes('resolved'));
  assert.ok(!M.allowedStatuses(pending).includes('voicemail'));
  assert.throws(() => dispatch(state, 'request.status', { id: pending.id, status: 'resolved' }), /practice confirmation/);
});

test('flat-action compatibility and message-linked requests retain bounded metadata', () => {
  let state = M.dispatch(blank(), { type: 'request.create', requestType: 'conference', studentId: 'student-a', summary: 'Sample meeting request', dueDate: '2026-10-23', details: { proposedTime: 'After school on Friday', messageId: 'message-123' } }, parent);
  const request = last(state.requests);
  assert.equal(request.date, today);
  assert.equal(request.details.messageId, 'message-123');
  state = M.dispatch(state, { type: 'request.status', id: request.id, status: 'reviewed' }, teacher);
  assert.equal(last(state.requests).status, 'reviewed');
});

test('support requested-by dates and 1,500-character request details match the composer', () => {
  const state = freeze(blank());
  const before = clone(state);
  const supported = req(state, { type: 'support', dueDate: '2026-10-23', details: { detail: 'x'.repeat(1500), attendanceReason: 'y'.repeat(1500), proposedTime: 'z'.repeat(1500) } });
  const request = last(supported.requests);
  assert.equal(request.date, today);
  assert.equal(request.dueDate, '2026-10-23');
  assert.equal(request.details.detail.length, 1500);
  assert.throws(() => req(state, { type: 'support', dueDate: '2026-02-30' }), /Invalid due date/);
  assert.throws(() => req(state, { type: 'support', details: { detail: 'x'.repeat(1501) } }), /Invalid detail/);
  assert.throws(() => req(state, { type: 'attendance', date: today, dueDate: '2026-10-23' }), /call, conference, and support/);
  assert.deepEqual(state, before);
});

test('private message-derived requests are visible only to the intended guardian and scoped teachers', () => {
  let state = req(blank(), { type: 'support', summary: 'TARGETED FOLLOW-UP', dueDate: '2026-10-23', details: { messageId: 'private-message-a' }, owner: 'family', recipientActorId: parent.actorId }, teacher);
  const targetedId = last(state.requests).id;
  state = req(state, { type: 'call', summary: 'SHARED FAMILY CONTACT', owner: 'family' }, teacher);
  state = req(state, { type: 'call', summary: 'TARGETED TEACHER NOTE', recipientActorId: parent.actorId, visibleToFamily: false }, teacher);
  assert.deepEqual(M.getVisibleRequests(state, parent).map(row => row.summary), ['TARGETED FOLLOW-UP', 'SHARED FAMILY CONTACT']);
  assert.deepEqual(M.getVisibleRequests(state, otherParent).map(row => row.summary), ['SHARED FAMILY CONTACT']);
  assert.equal(M.getVisibleRequests(state, teacher).length, 3);
  assert.ok(M.getQueue(state, parent, 'action').some(row => row.id === targetedId));
  assert.ok(!M.getQueue(state, otherParent, 'action').some(row => row.id === targetedId));
  assert.deepEqual(M.getVisibleRequests(state, { ...parent, guardianIds: ['student-b'] }), []);
  assert.throws(() => req(state, { recipientActorId: parent.actorId }, parent), /Only a classroom teacher can address/);
  assert.throws(() => req(state, { recipientActorId: null }, parent), /Only a classroom teacher can address/);
  assert.throws(() => req(state, { recipientActorId: 'constructor' }, teacher), /Invalid recipient actor ID/);
  assert.throws(() => req(state, { recipientActorId: 'x'.repeat(121) }, teacher), /Invalid recipient actor ID/);
  const sharedSeed = seeded();
  assert.ok(M.getVisibleRequests(sharedSeed, otherParent).some(row => row.type === 'call' && row.status === 'call_needed'));
});

test('status history retains each bounded contact note and ownership transition', () => {
  let state = seeded();
  const id = state.requests.find(row => row.type === 'call').id;
  state = dispatch(state, 'request.status', { id, status: 'attempted', owner: 'teacher', note: 'Fictional first attempt: line was busy.' });
  const afterFirst = freeze(state);
  state = dispatch(afterFirst, 'request.status', { id, status: 'voicemail', owner: 'family', note: 'Fictional second attempt: left a callback request.' });
  const history = state.history.filter(row => row.recordId === id);
  assert.deepEqual(history.map(row => row.note), ['Fictional first attempt: line was busy.', 'Fictional second attempt: left a callback request.']);
  assert.deepEqual(history.map(row => [row.previousOwner, row.newOwner]), [['family', 'teacher'], ['teacher', 'family']]);
  assert.equal(state.requests.find(row => row.id === id).statusNote, 'Fictional second attempt: left a callback request.');
  assert.equal(afterFirst.history.filter(row => row.recordId === id).length, 1);
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'follow_up', note: 'x'.repeat(1201) }), /Invalid status note/);
  const noNote = dispatch(state, 'request.status', { id, status: 'follow_up' });
  assert.equal(last(noNote.history).note, '');
  assert.equal(last(noNote.history).previousOwner, 'family');
  assert.equal(last(noNote.history).newOwner, 'family');
  assert.equal(history[0].from, 'call_needed');
  assert.equal(history[1].to, 'voicemail');
});

test('early attendance pickup requires a time, named adult, and explicit adult verification', () => {
  const base = freeze(seeded());
  assert.throws(() => req(base, { type: 'attendance', date: today, details: { attendanceReason: 'early', adult: 'Fictional Adult' } }), /early pickup time/);
  assert.throws(() => req(base, { type: 'attendance', date: today, details: { attendanceReason: 'early', earlyTime: '13:15' } }), /early pickup adult/);
  let state = req(base, { type: 'attendance', date: today, summary: 'PRIVATE EARLY ATTENDANCE REASON', details: { attendanceReason: 'early', earlyTime: '13:15', adult: 'Fictional Adult', detail: 'PRIVATE MEDICAL NOTE' } });
  const id = last(state.requests).id;
  assert.equal(state.requests.length, base.requests.length + 1);
  assert.equal(last(state.requests).type, 'attendance');
  assert.equal(M.getPlan(state, 'student-a', today).method, 'bus');
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'confirmed' }), /required school-authorized/);
  assert.throws(() => dispatch(state, 'request.status', { id, status: 'confirmed', verifiedRoute: true }), /required school-authorized/);
  state = dispatch(state, 'request.status', { id, status: 'confirmed', verifiedAuthorizedAdult: true });
  const plan = M.getPlan(state, 'student-a', today);
  assert.equal(plan.method, 'pickup');
  assert.equal(plan.adult, 'Fictional Adult');
  assert.equal(plan.requestId, id);
  assert.match(plan.detail, /13:15/);
  assert.doesNotMatch(JSON.stringify(plan), /PRIVATE/);
  assert.equal(M.getPlan(state, 'student-a', '2026-10-20').method, 'bus');
  assert.deepEqual(state.dismissalPlans, base.dismissalPlans);
  state = dispatch(state, 'request.status', { id, status: 'resolved' });
  assert.equal(M.getPlan(state, 'student-a', today).requestId, id);
});

test('cancelled early pickup restores the default and ordinary attendance never changes transport', () => {
  let state = req(seeded(), { type: 'attendance', date: today, details: { attendanceReason: 'early', earlyTime: '12:45', adult: 'Fictional Adult' } });
  const id = last(state.requests).id;
  const cancelledPending = dispatch(state, 'request.status', { id, status: 'cancelled' }, parent);
  assert.equal(M.getPlan(cancelledPending, 'student-a', today).method, 'bus');
  state = dispatch(state, 'request.status', { id, status: 'confirmed', verifiedAuthorizedAdult: true });
  state = dispatch(state, 'request.status', { id, status: 'cancelled' });
  assert.equal(M.getPlan(state, 'student-a', today).source, 'default');
  for (const attendanceReason of ['absent', 'late', 'other']) {
    let ordinary = req(seeded(), { type: 'attendance', date: today, details: { attendanceReason, earlyTime: '10:30', adult: 'Fictional Adult' } });
    const ordinaryId = last(ordinary.requests).id;
    ordinary = dispatch(ordinary, 'request.status', { id: ordinaryId, status: 'confirmed', verifiedAuthorizedAdult: true });
    assert.equal(M.getPlan(ordinary, 'student-a', today).method, 'bus');
    assert.equal(M.getPlan(ordinary, 'student-a', today).source, 'default');
  }
});

test('early attendance and dismissal changes share the same latest verified confirmation ordering', () => {
  let state = req(seeded(), { type: 'attendance', date: today, details: { attendanceReason: 'early', earlyTime: '13:00', adult: 'Fictional Early Adult' } });
  const earlyId = last(state.requests).id;
  state = req(state, { type: 'dismissal', date: today, details: { method: 'daycare', detail: 'Fictional daycare route' } });
  const dismissalId = last(state.requests).id;
  state = dispatch(state, 'request.status', { id: dismissalId, status: 'confirmed', verifiedRoute: true });
  state = dispatch(state, 'request.status', { id: earlyId, status: 'confirmed', verifiedAuthorizedAdult: true });
  assert.equal(M.getPlan(state, 'student-a', today).requestId, earlyId);
  state = dispatch(state, 'request.status', { id: earlyId, status: 'cancelled' });
  assert.equal(M.getPlan(state, 'student-a', today).requestId, dismissalId);
});

test('an explicit authorized private reply moves a support request to teacher follow-up', () => {
  const state = freeze(req(blank(), { type: 'support', summary: 'Fictional reply-required question', owner: 'family', recipientActorId: parent.actorId, details: { messageId: 'teacher-message-a' } }, teacher));
  const id = last(state.requests).id;
  assert.ok(M.getQueue(state, parent, 'action').some(row => row.id === id));
  assert.throws(() => dispatch(state, 'request.reply', { id, messageId: 'reply-a' }, teacher), /Only a linked parent/);
  assert.throws(() => dispatch(state, 'request.reply', { id, messageId: 'reply-a' }, otherParent), /not visible to this guardian/);
  assert.throws(() => dispatch(state, 'request.reply', { id, messageId: 'reply-a' }, { ...parent, guardianIds: ['student-b'] }), /not available/);
  const next = dispatch(state, 'request.reply', { id, messageId: 'reply-a' }, parent);
  const updated = last(next.requests);
  assert.equal(updated.owner, 'teacher');
  assert.equal(updated.status, 'follow_up');
  assert.deepEqual(updated.reply, { messageId: 'reply-a', actorId: parent.actorId, at: parent.now, practice: true });
  assert.ok(M.getQueue(next, teacher, 'action').some(row => row.id === id));
  assert.ok(M.getQueue(next, parent, 'waiting').some(row => row.id === id));
  assert.ok(!M.getQueue(next, parent, 'completed').some(row => row.id === id));
  assert.deepEqual([last(next.history).from, last(next.history).to, last(next.history).previousOwner, last(next.history).newOwner], ['pending', 'follow_up', 'family', 'teacher']);
  assert.deepEqual(last(next.history).reply, updated.reply);
  assert.equal(last(state.requests).owner, 'family');
  assert.throws(() => dispatch(next, 'request.reply', { id, messageId: 'reply-b' }, parent), /not waiting/);
});

test('request replies never clear calls, closed support requests, or another guardian authored request', () => {
  const state = freeze(seeded());
  const callId = state.requests.find(row => row.type === 'call').id;
  assert.throws(() => dispatch(state, 'request.reply', { id: callId, messageId: 'written-reply' }, parent), /cannot complete a call/);
  assert.ok(M.getQueue(state, parent, 'action').some(row => row.id === callId));
  let authored = req(blank());
  const id = last(authored.requests).id;
  authored = dispatch(authored, 'request.status', { id, status: 'reviewed', owner: 'family' });
  assert.throws(() => dispatch(authored, 'request.reply', { id, messageId: 'other-reply' }, otherParent), /not visible to this guardian/);
  assert.throws(() => dispatch(authored, 'request.reply', { id, messageId: 'constructor' }, parent), /Invalid reply message ID/);
  const closed = dispatch(authored, 'request.status', { id, status: 'resolved' });
  assert.throws(() => dispatch(closed, 'request.reply', { id, messageId: 'late-reply' }, parent), /not waiting/);
});
