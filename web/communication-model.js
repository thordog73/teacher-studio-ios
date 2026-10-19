/* Teacher Studio Build 12: pure, local-practice communication workflows.
 * No network, DOM, storage, authentication, notification, or real approvals.
 * guardianIds follows app.js terminology: IDs of the caller's linked students.
 * The caller supplies its current classroom roster as ctx.studentIds.
 * dispatch accepts {type, payload}; flat actions are also accepted (request.create
 * uses requestType for its flat request type). Every returned record is a copy.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TeacherCommunicationModel = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 12;
  const REQUEST_TYPES = ['attendance', 'dismissal', 'call', 'support', 'conference'];
  const METHODS = ['bus', 'pickup', 'daycare', 'walk', 'activity', 'other'];
  const OWNERS = ['teacher', 'office', 'family'];
  const TERMINAL = ['confirmed', 'declined', 'resolved', 'cancelled'];
  const STATUSES = ['pending', 'reviewed', 'confirmed', 'declined', 'call_needed', 'attempted', 'voicemail', 'reached', 'follow_up', 'resolved', 'cancelled'];
  const RESERVED = ['__proto__', 'prototype', 'constructor'];
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };

  function object(value, label) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') fail(label + ' must be an object.');
    return value;
  }
  function fields(value, allowed, label) {
    object(value, label);
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('Unknown ' + label + ' field: ' + key + '.');
    return value;
  }
  function text(value, label, max, required) {
    if (value === undefined || value === null) value = '';
    if (typeof value !== 'string') fail(label + ' must be text.');
    value = value.trim();
    if ((required && !value) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail('Invalid ' + label + '.');
    return value;
  }
  function id(value, label) {
    value = text(value, label, 120, true);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:@-]*$/.test(value) || RESERVED.includes(value)) fail('Invalid ' + label + '.');
    return value;
  }
  function choice(value, allowed, label) {
    if (!allowed.includes(value)) fail('Invalid ' + label + '.');
    return value;
  }
  function bool(value, label) {
    if (typeof value !== 'boolean') fail(label + ' must be true or false.');
    return value;
  }
  function date(value, label, optional) {
    if (optional && (value === undefined || value === null || value === '')) return '';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Invalid ' + label + '; use YYYY-MM-DD.');
    const parsed = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('Invalid ' + label + '.');
    return value;
  }
  function time(value, label) {
    value = text(value, label, 5, false);
    if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('Invalid ' + label + '; use HH:MM.');
    return value;
  }
  function ids(value, label) {
    if (!Array.isArray(value) || value.length > 5000) fail(label + ' must be an array.');
    const result = value.map(valueId => id(valueId, label));
    if (new Set(result).size !== result.length) fail(label + ' contains duplicate IDs.');
    return result;
  }
  function calendarOffset(value, amount) {
    const parsed = new Date(date(value, 'date') + 'T12:00:00Z');
    parsed.setUTCDate(parsed.getUTCDate() + amount);
    return parsed.toISOString().slice(0, 10);
  }
  function localDate(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return date(value, 'local date');
    const parsed = value === undefined ? new Date() : new Date(value);
    if (!Number.isFinite(parsed.getTime())) fail('Invalid local date.');
    return String(parsed.getFullYear()).padStart(4, '0') + '-' + String(parsed.getMonth() + 1).padStart(2, '0') + '-' + String(parsed.getDate()).padStart(2, '0');
  }
  function stamp(ctx) {
    if (ctx.now === undefined || ctx.now === null || ctx.now === '') return date(ctx.today, 'today') + 'T12:00:00';
    const value = text(ctx.now, 'timestamp', 64, true);
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(value) || !Number.isFinite(Date.parse(value))) fail('Invalid timestamp.');
    date(value.slice(0, 10), 'timestamp date');
    return value;
  }
  function stateCheck(state) {
    object(state, 'state');
    if (state.version !== VERSION) fail('Unsupported communication state.');
    if (state.classId) id(state.classId, 'class ID');
    ids(state.studentIds, 'classroom students');
    for (const key of ['requests', 'dismissalPlans', 'forms', 'formResponses', 'faqEdits', 'history']) {
      if (!Array.isArray(state[key])) fail('Invalid state collection: ' + key + '.');
    }
    for (const key of ['preferences', 'messageMeta']) object(state[key], key);
    return state;
  }
  function context(state, ctx, mutate) {
    stateCheck(state);
    object(ctx, 'context');
    choice(ctx.role, ['parent', 'teacher'], 'role');
    if (ctx.classId !== undefined && ctx.classId !== state.classId) fail('Classroom is outside this context.');
    const roster = ids(ctx.studentIds, 'context students');
    const linked = ids(ctx.guardianIds || [], 'linked students');
    if (mutate) {
      if (ctx.mode !== 'demo' || state.mode !== 'demo') fail('Communication changes are available only in local practice mode.');
      if (!state.classId) fail('Select a classroom first.');
      id(ctx.actorId, 'actor ID');
      date(ctx.today, 'today');
      stamp(ctx);
    }
    return { roster, linked };
  }
  function canStudent(state, ctx, studentId) {
    return state.studentIds.includes(studentId) && ctx.studentIds.includes(studentId) && (ctx.role === 'teacher' || (ctx.guardianIds || []).includes(studentId));
  }
  function student(state, ctx, studentId) {
    studentId = id(studentId, 'student ID');
    if (!canStudent(state, ctx, studentId)) fail('Student is not available in this classroom context.');
    return studentId;
  }
  function teacher(ctx) {
    if (ctx.role !== 'teacher') fail('Only a classroom teacher may perform this action.');
  }
  function record(state, ctx, collection, recordId) {
    recordId = id(recordId, 'record ID');
    const found = state[collection].find(row => row.id === recordId && row.classId === state.classId);
    if (!found || (found.studentId && !canStudent(state, ctx, found.studentId))) fail('Record is not available in this classroom context.');
    return found;
  }
  function nextId(state, prefix) {
    const taken = new Set([].concat(state.requests, state.forms, state.dismissalPlans, state.faqEdits).map(row => row.id));
    let candidate;
    do {
      state.sequence = (Number.isSafeInteger(state.sequence) && state.sequence >= 0 ? state.sequence : 0) + 1;
      candidate = 'comm-' + prefix + '-' + state.sequence;
    } while (taken.has(candidate));
    return candidate;
  }
  function log(state, ctx, action, recordId, extra) {
    state.sequence = (Number.isSafeInteger(state.sequence) && state.sequence >= 0 ? state.sequence : 0) + 1;
    state.history.push(Object.assign({ action, recordId, actorId: ctx.actorId, role: ctx.role, at: stamp(ctx), sequence: state.sequence, practice: true }, extra || {}));
  }
  function requestDetails(value) {
    const input = fields(value || {}, ['attendanceReason', 'method', 'detail', 'adult', 'earlyTime', 'proposedTime', 'messageId'], 'request details');
    const result = {};
    for (const key of ['attendanceReason', 'detail', 'adult', 'proposedTime']) {
      if (has(input, key)) result[key] = text(input[key], key, 1500, false);
    }
    if (has(input, 'method')) result.method = choice(input.method, METHODS, 'dismissal method');
    if (has(input, 'earlyTime')) result.earlyTime = time(input.earlyTime, 'early time');
    if (has(input, 'messageId')) result.messageId = id(input.messageId, 'message ID');
    return result;
  }
  function isEarlyPickup(request) {
    return request.type === 'attendance' && request.details && request.details.attendanceReason === 'early';
  }
  function normalizeAction(action) {
    object(action, 'action');
    const actionType = text(action.type, 'action type', 60, true);
    let payload;
    if (has(action, 'payload')) {
      fields(action, ['type', 'payload'], 'action');
      payload = object(action.payload, 'payload');
    } else {
      payload = Object.fromEntries(Object.entries(action).filter(([key]) => key !== 'type'));
      if (actionType === 'request.create' && has(payload, 'requestType')) {
        payload.type = payload.requestType;
        delete payload.requestType;
      }
    }
    return { type: actionType, payload };
  }

  function seed(meta, dateISO) {
    object(meta, 'metadata');
    dateISO = date(dateISO, 'seed date');
    const classId = meta.classId ? id(meta.classId, 'class ID') : '';
    const students = (meta.students || []).map(row => ({ id: id(row.id, 'student ID'), display_name: text(row.display_name || '', 'student name', 160, false) }));
    const studentIds = ids(students.map(row => row.id), 'classroom students');
    const linked = ids(meta.guardianIds || [], 'linked students').filter(studentId => studentIds.includes(studentId));
    const state = {
      version: VERSION, mode: meta.mode === 'demo' ? 'demo' : 'cloud', classId,
      students, studentIds, sequence: 0,
      requests: [], dismissalPlans: [], forms: [], formResponses: [], preferences: {},
      faqEdits: [], messageMeta: {}, learning: {}, history: [],
      settings: { schoolPhone: '', dismissalCutoff: '', responseWindow: '', teacherPhone: '' }
    };
    if (state.mode !== 'demo' || !classId || !linked.length) return state;
    const first = linked[0];
    const at = dateISO + 'T09:00:00';
    const parentActor = meta.role === 'parent' && meta.actorId ? id(meta.actorId, 'actor ID') : 'demo-parent';
    const teacherActor = meta.role === 'teacher' && meta.actorId ? id(meta.actorId, 'actor ID') : 'demo-teacher';
    for (const weekday of [1, 2, 3, 4, 5]) state.dismissalPlans.push({
      id: nextId(state, 'plan'), classId, studentId: first, weekday, method: 'bus',
      detail: 'Bus 12 — fictional sample route', adult: '', practice: true, updatedAt: at, updatedBy: teacherActor
    });
    state.requests.push({
      id: nextId(state, 'request'), classId, studentId: first, type: 'attendance', date: dateISO, dueDate: '',
      summary: 'Fictional example: attendance note awaiting office review.',
      details: { attendanceReason: 'Sample late arrival', earlyTime: '09:30' },
      owner: 'office', visibleToFamily: true, status: 'pending', createdBy: parentActor,
      createdRole: 'parent', createdAt: at, updatedAt: at, practice: true
    });
    state.requests.push({
      id: nextId(state, 'request'), classId, studentId: first, type: 'call', date: dateISO, dueDate: dateISO,
      summary: 'Fictional example: please contact the teacher about a classroom check-in today.', details: {},
      owner: 'family', visibleToFamily: true, status: 'call_needed', createdBy: teacherActor,
      createdRole: 'teacher', createdAt: at, updatedAt: at, practice: true
    });
    state.forms.push({
      id: nextId(state, 'form'), classId, title: 'Fictional classroom activity permission',
      dueDate: calendarOffset(dateISO, 1), body: 'Practice only: record a sample family response for a fictional classroom activity.',
      studentIds: [first], createdBy: teacherActor, createdAt: at, practice: true
    });
    const sampleAssignment = classId === 'demo-class' && Array.isArray(meta.assignments) ? meta.assignments[1] : null;
    if (sampleAssignment && sampleAssignment.classroom_id === classId && (!sampleAssignment.student_id || sampleAssignment.student_id === first) && /^(demo-|sample-)/.test(sampleAssignment.id)) {
      const assignmentId = id(sampleAssignment.id, 'assignment ID');
      state.learning[first] = { [assignmentId]: { studentId: first, assignmentId, status: 'missing', practiceNote: 'Start with the first five questions; ask your teacher if you need help.', updatedAt: at, updatedBy: teacherActor, practice: true } };
    }
    return state;
  }

  function allowedStatuses(request) {
    object(request, 'request');
    choice(request.type, REQUEST_TYPES, 'request type');
    choice(request.status, STATUSES, 'request status');
    if (TERMINAL.includes(request.status)) return request.status === 'confirmed' ? ['confirmed', 'resolved', 'cancelled'] : [request.status];
    let result = STATUSES.filter(value => value !== 'pending' || request.status === 'pending');
    if (['attendance', 'dismissal'].includes(request.type)) result = result.filter(value => !['call_needed', 'attempted', 'voicemail', 'reached'].includes(value) && (value !== 'resolved' || !!request.confirmedAt));
    if (request.type === 'call') result = result.filter(value => value !== 'confirmed' && (value !== 'resolved' || !!request.reachedAt));
    return result;
  }

  function dispatch(state, action, ctx) {
    context(state, ctx, true);
    const input = normalizeAction(action);
    const p = input.payload;
    const next = copy(state);
    const at = stamp(ctx);
    let target;

    switch (input.type) {
      case 'request.create': {
        fields(p, ['type', 'studentId', 'date', 'dueDate', 'summary', 'details', 'owner', 'visibleToFamily', 'recipientActorId'], 'request');
        const type = choice(p.type, REQUEST_TYPES, 'request type');
        const studentId = student(next, ctx, p.studentId);
        const requestDate = date((p.date === undefined || p.date === null || p.date === '') && !['attendance', 'dismissal'].includes(type) ? ctx.today : p.date, 'request date');
        const dueDate = date(p.dueDate, 'due date', true);
        if (dueDate && !['call', 'conference', 'support'].includes(type)) fail('A due date is supported for call, conference, and support requests.');
        if (has(p, 'recipientActorId') && ctx.role !== 'teacher') fail('Only a classroom teacher can address a request to a specific guardian.');
        const recipientActorId = p.recipientActorId === undefined || p.recipientActorId === null || p.recipientActorId === '' ? null : id(p.recipientActorId, 'recipient actor ID');
        const details = requestDetails(p.details);
        if (type === 'dismissal' && !details.method) fail('Choose a dismissal method.');
        if (type === 'dismissal' && details.method === 'pickup' && !details.adult) fail('Name the proposed pickup adult.');
        if (type === 'attendance' && details.attendanceReason === 'early') {
          if (!details.earlyTime) fail('Provide the proposed early pickup time.');
          if (!details.adult) fail('Name the proposed early pickup adult.');
        }
        const owner = choice(p.owner || (['attendance', 'dismissal'].includes(type) ? 'office' : 'teacher'), OWNERS, 'request owner');
        const visibleToFamily = p.visibleToFamily === undefined ? true : bool(p.visibleToFamily, 'family visibility');
        if (ctx.role === 'parent' && (!visibleToFamily || owner === 'family')) fail('A parent request must remain visible to its author and go to a school role.');
        target = {
          id: nextId(next, 'request'), classId: next.classId, type, studentId, date: requestDate, dueDate,
          summary: text(p.summary, 'request summary', 1500, true), details, owner, visibleToFamily, recipientActorId,
          status: type === 'call' && ctx.role === 'teacher' ? 'call_needed' : 'pending',
          createdBy: ctx.actorId, createdRole: ctx.role, createdAt: at, updatedAt: at, practice: true
        };
        next.requests.push(target);
        log(next, ctx, input.type, target.id);
        break;
      }
      case 'request.status': {
        fields(p, ['id', 'status', 'owner', 'note', 'verifiedAuthorizedAdult', 'verifiedRoute'], 'request status');
        target = record(next, ctx, 'requests', p.id);
        const status = choice(p.status, STATUSES, 'request status');
        if (ctx.role === 'parent') {
          if (status !== 'cancelled' || target.status !== 'pending' || target.createdRole !== 'parent' || target.createdBy !== ctx.actorId) fail('A parent may only cancel their own pending request.');
          if (has(p, 'owner') || has(p, 'verifiedAuthorizedAdult') || has(p, 'verifiedRoute')) fail('Only the teacher can change routing or record practice verification.');
        } else {
          teacher(ctx);
          if (status === 'pending' && target.status !== 'pending') fail('Create a new request instead of reverting an existing request to pending.');
          if (TERMINAL.includes(target.status) && status !== target.status && !(target.status === 'confirmed' && ['resolved', 'cancelled'].includes(status))) fail('This request is closed; create a new request for another action.');
          if (['attendance', 'dismissal'].includes(target.type) && ['call_needed', 'attempted', 'voicemail', 'reached'].includes(status)) fail('Use a separate contact request to track a call.');
          if (target.type === 'call' && status === 'confirmed') fail('Record reached for successful contact, then resolve the follow-up explicitly.');
          if (target.type === 'call' && status === 'resolved' && !target.reachedAt) fail('Record successful contact before resolving this call request.');
          if (['attendance', 'dismissal'].includes(target.type) && status === 'resolved' && !target.confirmedAt) fail('Record practice confirmation before resolving this request.');
        }
        if (has(p, 'verifiedAuthorizedAdult')) bool(p.verifiedAuthorizedAdult, 'authorized adult verification');
        if (has(p, 'verifiedRoute')) bool(p.verifiedRoute, 'route verification');
        if (status === 'confirmed' && (target.type === 'dismissal' || isEarlyPickup(target))) {
          if ((isEarlyPickup(target) || target.details.method === 'pickup') ? p.verifiedAuthorizedAdult !== true : p.verifiedRoute !== true) fail('Record the required school-authorized adult or route check for this practice confirmation.');
          target.confirmation = { verifiedAuthorizedAdult: p.verifiedAuthorizedAdult === true, verifiedRoute: p.verifiedRoute === true, actorId: ctx.actorId, at, practice: true };
        }
        const previousStatus = target.status;
        const previousOwner = target.owner;
        const note = has(p, 'note') ? text(p.note, 'status note', 1200, false) : '';
        target.status = status;
        target.updatedAt = at;
        if (status === 'confirmed') { target.confirmedAt = at; target.confirmedSequence = (next.sequence || 0) + 1; }
        if (status === 'reached') target.reachedAt = at;
        if (status === 'resolved') target.resolvedAt = at;
        if (status === 'cancelled') target.cancelledAt = at;
        if (has(p, 'owner')) target.owner = choice(p.owner, OWNERS, 'request owner');
        if (has(p, 'note')) target.statusNote = note;
        log(next, ctx, input.type, target.id, { from: previousStatus, to: status, note, previousOwner, newOwner: target.owner });
        break;
      }
      case 'request.reply': {
        if (ctx.role !== 'parent') fail('Only a linked parent can record a family reply.');
        fields(p, ['id', 'messageId'], 'request reply');
        target = record(next, ctx, 'requests', p.id);
        if (!getVisibleRequests(next, ctx, target.studentId).some(row => row.id === target.id)) fail('Request is not visible to this guardian.');
        if (target.type !== 'support') fail('A written reply can update only a support request; it cannot complete a call.');
        if (target.owner !== 'family' || TERMINAL.includes(target.status)) fail('This request is not waiting for a family reply.');
        const reply = { messageId: id(p.messageId, 'reply message ID'), actorId: ctx.actorId, at, practice: true };
        const previousStatus = target.status;
        const previousOwner = target.owner;
        target.reply = reply;
        target.owner = 'teacher';
        target.status = 'follow_up';
        target.updatedAt = at;
        log(next, ctx, input.type, target.id, { from: previousStatus, to: target.status, previousOwner, newOwner: target.owner, reply: copy(reply) });
        break;
      }
      case 'dismissal.plan': {
        teacher(ctx);
        fields(p, ['studentId', 'weekday', 'method', 'detail', 'adult'], 'dismissal plan');
        const studentId = student(next, ctx, p.studentId);
        if (!Number.isInteger(p.weekday) || p.weekday < 0 || p.weekday > 6) fail('Weekday must be an integer from 0 through 6.');
        const method = choice(p.method, METHODS, 'dismissal method');
        const adult = text(p.adult, 'pickup adult', 120, false);
        if (method === 'pickup' && !adult) fail('Name the default pickup adult.');
        target = next.dismissalPlans.find(row => row.classId === next.classId && row.studentId === studentId && row.weekday === p.weekday);
        const planId = target ? target.id : nextId(next, 'plan');
        const value = { id: planId, classId: next.classId, studentId, weekday: p.weekday, method, detail: text(p.detail, 'route detail', 600, false), adult, updatedAt: at, updatedBy: ctx.actorId, practice: true };
        if (target) Object.assign(target, value); else next.dismissalPlans.push(value);
        log(next, ctx, input.type, planId);
        break;
      }
      case 'form.create': {
        teacher(ctx);
        fields(p, ['title', 'dueDate', 'body', 'studentIds'], 'form');
        const studentIds = ids(p.studentIds || [], 'form students');
        studentIds.forEach(studentId => student(next, ctx, studentId));
        if (!studentIds.length && !next.studentIds.every(studentId => canStudent(next, ctx, studentId))) fail('Whole-class forms require access to the whole classroom roster.');
        target = { id: nextId(next, 'form'), classId: next.classId, title: text(p.title, 'form title', 180, true), dueDate: date(p.dueDate, 'form due date', true), body: text(p.body, 'form body', 5000, true), studentIds, createdBy: ctx.actorId, createdAt: at, practice: true };
        next.forms.push(target);
        log(next, ctx, input.type, target.id);
        break;
      }
      case 'form.respond': {
        if (ctx.role !== 'parent') fail('Only a linked parent can record a family response.');
        fields(p, ['formId', 'studentId', 'response', 'guardian'], 'form response');
        const studentId = student(next, ctx, p.studentId);
        const form = record(next, ctx, 'forms', p.formId);
        if (form.studentIds.length && !form.studentIds.includes(studentId)) fail('This form is not assigned to that student.');
        if (has(p, 'guardian') && p.guardian !== ctx.actorId) fail('The response guardian must match the current actor.');
        const response = choice(p.response, ['agreed', 'declined'], 'form response');
        target = next.formResponses.find(row => row.formId === form.id && row.studentId === studentId && row.guardian === ctx.actorId && row.classId === next.classId);
        const value = { formId: form.id, classId: next.classId, studentId, response, guardian: ctx.actorId, updatedAt: at, practice: true };
        if (target) Object.assign(target, value); else next.formResponses.push(value);
        log(next, ctx, input.type, form.id, { studentId });
        break;
      }
      case 'message.meta': {
        teacher(ctx);
        fields(p, ['messageId', 'requirement', 'dueDate', 'studentId'], 'message metadata');
        const messageId = id(p.messageId, 'message ID');
        const studentId = p.studentId === null || p.studentId === undefined ? null : student(next, ctx, p.studentId);
        if (studentId === null && !next.studentIds.every(value => canStudent(next, ctx, value))) fail('Class announcements require access to the whole classroom roster.');
        const requirement = choice(p.requirement, ['info', 'ack', 'reply', 'call'], 'message requirement');
        const dueDate = date(p.dueDate, 'message due date', true);
        const old = next.messageMeta[messageId];
        const unchangedAudienceAndAction = old && old.classId === next.classId && old.studentId === studentId && old.requirement === requirement && old.dueDate === dueDate;
        next.messageMeta[messageId] = { messageId, classId: next.classId, requirement, dueDate, studentId, acknowledgments: unchangedAudienceAndAction ? old.acknowledgments : {}, updatedAt: at, updatedBy: ctx.actorId, practice: true };
        log(next, ctx, input.type, messageId);
        break;
      }
      case 'message.ack': {
        if (ctx.role !== 'parent') fail('Only a linked parent can acknowledge a message.');
        fields(p, ['messageId', 'studentId'], 'message acknowledgment');
        const studentId = student(next, ctx, p.studentId);
        const messageId = id(p.messageId, 'message ID');
        target = next.messageMeta[messageId];
        if (!target || target.classId !== next.classId || (target.studentId && target.studentId !== studentId)) fail('Message is not available for that student.');
        if (target.requirement !== 'ack') fail('Acknowledgment cannot complete a message requiring a reply or call.');
        target.acknowledgments[studentId] = { studentId, actorId: ctx.actorId, at, practice: true };
        log(next, ctx, input.type, messageId, { studentId });
        break;
      }
      case 'preference.save': {
        fields(p, ['studentId', 'fields'], 'preference');
        const studentId = student(next, ctx, p.studentId);
        const inputFields = fields(p.fields, ['language', 'contactMethod', 'callbackWindow', 'phone'], 'preference');
        if (!Object.keys(inputFields).length) fail('Provide at least one preference.');
        if (!has(next.preferences, studentId)) next.preferences[studentId] = {};
        const existing = has(next.preferences[studentId], ctx.actorId) ? next.preferences[studentId][ctx.actorId] : {};
        const value = Object.assign({}, existing, { studentId, actorId: ctx.actorId, updatedAt: at, practice: true });
        for (const key of Object.keys(inputFields)) value[key] = text(inputFields[key], key, key === 'callbackWindow' ? 240 : 100, false);
        next.preferences[studentId][ctx.actorId] = value;
        log(next, ctx, input.type, studentId);
        break;
      }
      case 'settings.save': {
        teacher(ctx);
        fields(p, ['schoolPhone', 'dismissalCutoff', 'responseWindow', 'teacherPhone'], 'settings');
        if (!Object.keys(p).length) fail('Provide at least one setting.');
        if (!next.settings) next.settings = { schoolPhone: '', dismissalCutoff: '', responseWindow: '', teacherPhone: '' };
        for (const key of Object.keys(p)) next.settings[key] = key === 'dismissalCutoff' ? time(p[key], 'dismissal cutoff') : text(p[key], key, key === 'responseWindow' ? 500 : 100, false);
        log(next, ctx, input.type, next.classId);
        break;
      }
      case 'learning.save': {
        teacher(ctx);
        fields(p, ['studentId', 'assignmentId', 'status', 'practiceNote'], 'learning status');
        const studentId = student(next, ctx, p.studentId);
        const assignmentId = id(p.assignmentId, 'assignment ID');
        if (ctx.assignmentIds && !ctx.assignmentIds.includes(assignmentId)) fail('Assignment is not available in this classroom context.');
        if (!next.learning) next.learning = {};
        if (!has(next.learning, studentId)) next.learning[studentId] = {};
        next.learning[studentId][assignmentId] = { studentId, assignmentId, status: choice(p.status, ['upcoming', 'missing', 'submitted', 'complete'], 'learning status'), practiceNote: text(p.practiceNote, 'practice note', 1500, false), updatedAt: at, updatedBy: ctx.actorId, practice: true };
        log(next, ctx, input.type, assignmentId, { studentId });
        break;
      }
      case 'faq.save': {
        teacher(ctx);
        fields(p, ['id', 'question', 'answer', 'category', 'owner', 'reviewDate'], 'FAQ');
        const faqId = p.id ? id(p.id, 'FAQ ID') : nextId(next, 'faq');
        target = next.faqEdits.find(row => row.id === faqId && row.classId === next.classId);
        const value = { id: faqId, classId: next.classId, question: text(p.question, 'FAQ question', 300, true), answer: text(p.answer, 'FAQ answer', 5000, true), category: text(p.category, 'FAQ category', 80, false), owner: choice(p.owner || 'teacher', ['teacher', 'office'], 'FAQ owner'), reviewDate: date(p.reviewDate, 'FAQ review date', true), updatedAt: at, updatedBy: ctx.actorId, practice: true };
        if (target) Object.assign(target, value); else next.faqEdits.push(value);
        log(next, ctx, input.type, faqId);
        break;
      }
      default: fail('Unknown communication action: ' + input.type + '.');
    }
    return next;
  }

  function getVisibleRequests(state, ctx, studentId) {
    context(state, ctx, false);
    if (studentId !== undefined && studentId !== null && studentId !== '' && !canStudent(state, ctx, id(studentId, 'student ID'))) return [];
    return copy(state.requests.filter(row => row.classId === state.classId && canStudent(state, ctx, row.studentId) && (!studentId || row.studentId === studentId) && (ctx.role === 'teacher' || (row.visibleToFamily === true && (!row.recipientActorId || row.recipientActorId === ctx.actorId) && (row.createdRole !== 'parent' || row.createdBy === ctx.actorId)))));
  }
  function getQueue(state, ctx, filter) {
    filter = choice(filter || 'action', ['action', 'waiting', 'completed'], 'queue filter');
    return getVisibleRequests(state, ctx).map(row => {
      const bucket = TERMINAL.includes(row.status) ? 'completed' : (row.owner === (ctx.role === 'teacher' ? 'teacher' : 'family') ? 'action' : 'waiting');
      return Object.assign(row, { queue: bucket });
    }).filter(row => row.queue === filter);
  }
  function getPlan(state, studentId, dateISO, ctx) {
    stateCheck(state);
    studentId = id(studentId, 'student ID');
    dateISO = date(dateISO, 'dismissal date');
    if (!state.studentIds.includes(studentId)) fail('Student is not available in this classroom.');
    if (ctx) { context(state, ctx, false); student(state, ctx, studentId); }
    const weekday = new Date(dateISO + 'T12:00:00Z').getUTCDay();
    const defaults = state.dismissalPlans.filter(row => row.classId === state.classId && row.studentId === studentId && row.weekday === weekday);
    const base = defaults.length ? defaults[defaults.length - 1] : null;
    const confirmed = state.requests.map((row, index) => ({ row, index })).filter(({ row }) => {
      if (row.classId !== state.classId || row.studentId !== studentId || row.date !== dateISO || row.cancelledAt) return false;
      if (!(row.status === 'confirmed' || (row.status === 'resolved' && row.confirmedAt)) || !row.confirmation) return false;
      if (isEarlyPickup(row)) return row.confirmation.verifiedAuthorizedAdult === true && typeof row.details.earlyTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.details.earlyTime) && typeof row.details.adult === 'string' && !!row.details.adult.trim();
      return row.type === 'dismissal' && (row.details.method === 'pickup' ? row.confirmation.verifiedAuthorizedAdult === true : row.confirmation.verifiedRoute === true);
    });
    confirmed.sort((left, right) => (left.row.confirmedSequence && right.row.confirmedSequence ? left.row.confirmedSequence - right.row.confirmedSequence : Date.parse(left.row.confirmedAt) - Date.parse(right.row.confirmedAt)) || left.index - right.index);
    const request = confirmed.length ? confirmed[confirmed.length - 1].row : null;
    const source = request ? (isEarlyPickup(request) ? { method: 'pickup', adult: request.details.adult, detail: 'Early pickup at ' + request.details.earlyTime } : request.details) : base;
    return copy({ studentId, date: dateISO, weekday, method: source ? source.method : '', detail: source ? source.detail || '' : '', adult: source ? source.adult || '' : '', source: request ? 'request' : base ? 'default' : 'none', requestId: request ? request.id : null, practice: state.mode === 'demo' });
  }
  function getPreferences(state, ctx, studentId) {
    context(state, ctx, false);
    studentId = student(state, ctx, studentId);
    const values = state.preferences[studentId] || {};
    if (ctx.role === 'teacher') return copy(values);
    const actorId = id(ctx.actorId, 'actor ID');
    return has(values, actorId) ? { [actorId]: copy(values[actorId]) } : {};
  }
  function getLearning(state, ctx, studentId) {
    context(state, ctx, false);
    studentId = student(state, ctx, studentId);
    return copy((state.learning || {})[studentId] || {});
  }

  return Object.freeze({ VERSION, seed, dispatch, allowedStatuses, getPlan, getVisibleRequests, getQueue, getPreferences, getLearning, localDate });
});
