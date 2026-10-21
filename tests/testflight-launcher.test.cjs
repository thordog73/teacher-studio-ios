'use strict';
/* Codemagic launcher behavior tests. Every transport, Git query, prompt, and
 * state operation is injected. Live networking and process execution are
 * disabled before loading the launcher so a dependency-injection regression
 * cannot accidentally push source, trigger a build, or use a real credential. */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const childProcess = require('node:child_process');

function blocked() { throw new Error('Live networking and process execution are disabled in launcher tests.'); }
globalThis.fetch = blocked;
http.request = http.get = https.request = https.get = blocked;
for (const method of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) childProcess[method] = blocked;

const ROOT = path.resolve(__dirname, '..');
const CHECKOUT = path.resolve('/virtual/teacher-studio-launcher-tests');
const REPOSITORY = 'https://github.com/thordog73/teacher-studio-ios.git';
const COMMIT = 'a'.repeat(40);
const OTHER_COMMIT = 'b'.repeat(40);
const APP_ID = '650000000000000000000001';
const SECOND_APP_ID = '650000000000000000000002';
const BUILD_ID = '660000000000000000000001';
const TEAM_ID = '640000000000000000000001';
const TOKEN = 'fixture-secret-do-not-persist-9ce754b3';
const NOW = '2026-10-21T10:00:00.000Z';
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

const { run, selectApp } = require('../scripts/start-testflight.cjs');

function app(id = APP_ID, repository = REPOSITORY) {
  return { id, name: 'Teacher Studio', repository: { url: repository }, settings_source: 'file', last_build_id: null };
}

function build(id = BUILD_ID, status = 'building', options = {}) {
  const { commit = COMMIT, appId = APP_ID, ...rest } = options;
  return {
    id, app_id: appId,
    workflow: { id: 'ios-testflight', source: 'yaml', name: 'Teacher Studio TestFlight' },
    branch: 'main', status,
    commit: { hash: commit, url: `https://github.com/thordog73/teacher-studio-ios/commit/${commit}` },
    labels: [], created_at: NOW, ...rest,
  };
}

function fixture(options = {}) {
  const events = [], requests = [], writes = [], logs = [], gitCalls = [];
  const records = new Map(Object.entries(clone(options.records || {})));
  const builds = new Map((options.builds || []).map(value => [value.id, clone(value)]));
  let lockTail = Promise.resolve();
  const h = {
    events, requests, writes, logs, gitCalls, records, builds,
    apps: clone(options.apps || [app()]),
    personalApps: clone(options.personalApps || []),
    teams: clone(options.teams || [{ id: TEAM_ID, name: 'Fixture team' }]),
    origin: options.origin || REPOSITORY,
    head: options.head || COMMIT,
    remoteHead: options.remoteHead || COMMIT,
    getError: null, postError: null, failStartingWrite: false,
    promptCalls: 0, postSequence: 0,
  };
  const classic = data => ({ data: clone(data), current_page: 1, total_pages: 1, page_size: 100 });
  h.deps = {
    env: { CM_API_TOKEN: TOKEN, ...(options.env || {}) },
    log: message => logs.push(String(message)),
    now: () => NOW,
    promptToken: async () => { h.promptCalls++; return TOKEN; },
    git: async (args, context) => {
      gitCalls.push({ args: clone(args), cwd: context.cwd });
      events.push({ type: 'git', args: clone(args) });
      assert.equal(context.cwd, CHECKOUT, 'Git queries target only the injected checkout.');
      if (args.join('|') === 'remote|get-url|origin') return h.origin + '\n';
      if (args.join('|') === 'rev-parse|HEAD') return h.head + '\n';
      if (args.join('|') === 'ls-remote|--exit-code|origin|refs/heads/main') return h.remoteHead + '\trefs/heads/main\n';
      if (args[0] === 'show' && args[1] === `${h.head}:capacitor.config.json`) return fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8');
      if (args[0] === 'show' && args[1] === `${h.head}:codemagic.yaml`) return fs.readFileSync(path.join(ROOT, 'codemagic.yaml'), 'utf8');
      throw new Error('Unexpected mocked Git query: ' + JSON.stringify(args));
    },
    stateStore: {
      async read(key) { return clone(records.get(key) || null); },
      async write(key, value) {
        events.push({ type: 'write', key, phase: value.phase });
        if (h.failStartingWrite && value.phase === 'starting') throw new Error('Fixture state storage is unavailable.');
        writes.push({ key, value: clone(value) });
        records.set(key, clone(value));
      },
      async withLock(key, fn) {
        const previous = lockTail;
        let release;
        lockTail = new Promise(resolve => { release = resolve; });
        await previous;
        try { return await fn(); } finally { release(); }
      },
    },
    async request(request) {
      const entry = clone(request);
      requests.push(entry);
      events.push({ type: 'request', method: request.method, path: request.path });
      assert.equal(request.token, TOKEN, 'Only the injected fixture token reaches the injected transport.');
      const url = new URL(request.path, 'https://api.codemagic.io');
      assert.equal(url.origin, 'https://api.codemagic.io');
      if (request.method === 'GET' && h.getError) throw h.getError;
      if (request.method === 'GET' && url.pathname === '/api/v3/user/teams') return classic(h.teams);
      if (request.method === 'GET' && url.pathname === `/api/v3/teams/${TEAM_ID}/apps`) return classic(h.apps);
      if (request.method === 'GET' && url.pathname === '/api/v3/user/apps') return classic(h.personalApps);
      if (request.method === 'GET' && url.pathname === `/api/v3/teams/${TEAM_ID}/builds`) {
        return { data: clone([...builds.values()].filter(value => value.app_id === url.searchParams.get('app_id') && value.branch === url.searchParams.get('branch') && value.workflow.id === url.searchParams.get('workflow_id'))), page_size: 100, cursor: null };
      }
      if (request.method === 'GET' && /^\/api\/v3\/builds\//.test(url.pathname)) {
        const id = url.pathname.split('/').pop();
        const value = builds.get(id);
        if (!value) { const error = new Error('Fixture build does not exist.'); error.status = 404; throw error; }
        return { data: clone(value) };
      }
      if (request.method === 'POST' && url.pathname === '/builds') {
        h.postSequence++;
        if (h.postError) throw h.postError;
        const id = h.postSequence === 1 ? BUILD_ID : '66000000000000000000000' + String(h.postSequence);
        const value = build(id, 'queued', { appId: request.body.appId });
        value.labels = clone(request.body.labels || []);
        builds.set(id, value);
        return { buildId: id };
      }
      throw new Error('Unexpected mocked HTTP operation: ' + request.method + ' ' + url.pathname);
    },
  };
  h.launch = options => run({ checkout: CHECKOUT, ...(options || {}) }, h.deps);
  h.posts = () => requests.filter(value => value.method === 'POST');
  h.state = () => clone(records.get(COMMIT));
  return h;
}

async function outcome(fn) {
  try { return { value: await fn(), error: null }; }
  catch (error) { return { value: null, error }; }
}

function safeObservables(h, error = null) {
  const describe = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object') return String(value ?? '');
    if (seen.has(value)) return '[cycle]';
    seen.add(value);
    return Object.getOwnPropertyNames(value).map(key => key + ':' + describe(value[key], seen)).join('\n');
  };
  const visible = JSON.stringify({ logs: h.logs, writes: h.writes, records: [...h.records] }) + describe(error);
  assert.ok(!visible.includes(TOKEN), 'The fixture credential must never appear in logs, persisted state, or exposed error properties.');
}

function assertTargeted(post, id = APP_ID) {
  assert.equal(new URL(post.path, 'https://api.codemagic.io').pathname, '/builds');
  assert.equal(post.body.appId, id);
  assert.equal(post.body.workflowId, 'ios-testflight');
  assert.equal(post.body.branch, 'main');
  assert.equal(post.body.environment.variables.TEACHER_STUDIO_EXPECTED_COMMIT, COMMIT);
  assert.ok(Array.isArray(post.body.labels) && post.body.labels.length > 0, 'An attempt label enables reconciliation after an uncertain POST.');
}

test('verified repository and pushed commit produce one correctly targeted TestFlight POST after a durable starting record', async () => {
  const h = fixture();
  const result = await h.launch();
  assert.equal(result.started, true);
  assert.equal(result.appId, APP_ID);
  assert.equal(result.commit, COMMIT);
  assert.equal(result.buildId, BUILD_ID);
  assert.equal(h.posts().length, 1);
  assertTargeted(h.posts()[0]);
  const start = h.events.findIndex(event => event.type === 'write' && event.phase === 'starting');
  const post = h.events.findIndex(event => event.type === 'request' && event.method === 'POST');
  assert.ok(start >= 0 && start < post, 'A start marker must be stored before the potentially billable API call.');
  assert.equal(h.state().buildId, BUILD_ID);
  assert.equal(h.promptCalls, 0);
  safeObservables(h);
});

test('a different Git origin is rejected before any build can start', async () => {
  const h = fixture({ origin: 'https://github.com/someone/another-app.git' });
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.match(result.error.message, /repository|origin|remote/i);
  assert.equal(h.posts().length, 0);
});

test('local HEAD must equal the verified remote main commit', async () => {
  const h = fixture({ remoteHead: OTHER_COMMIT });
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.match(result.error.message, /commit|remote|main|push/i);
  assert.equal(h.posts().length, 0);
});

test('an explicit app ID does not bypass its repository binding', async () => {
  const h = fixture({ apps: [app(), app(SECOND_APP_ID, 'https://github.com/someone/another-app.git')], env: { CM_APP_ID: SECOND_APP_ID } });
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.match(result.error.message, /app|repository/i);
  assert.equal(h.posts().length, 0);
});

test('an explicit current repository overrides historical commit evidence for app selection', () => {
  const conflicting = {
    ...app(APP_ID, 'https://github.com/someone/another-app.git'),
    verifiedRepository: 'thordog73/teacher-studio-ios',
  };
  assert.throws(() => selectApp([conflicting], 'thordog73/teacher-studio-ios', APP_ID), /app|repository|verified/i);
});

test('multiple apps bound to the same repository require an actionable explicit selection', async () => {
  const h = fixture({ apps: [app(), app(SECOND_APP_ID)] });
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.match(result.error.message, /CM_APP_ID|CODEMAGIC_APP_ID|select|choose/i);
  assert.equal(h.posts().length, 0);
});

test('an explicit selection can resolve two independently verified matching apps', async () => {
  const h = fixture({ apps: [app(), app(SECOND_APP_ID)], env: { CM_APP_ID: SECOND_APP_ID } });
  const result = await h.launch();
  assert.equal(result.appId, SECOND_APP_ID);
  assert.equal(h.posts().length, 1);
  assertTargeted(h.posts()[0], SECOND_APP_ID);
});

test('an app name alone is insufficient to choose an unverified personal app', async () => {
  const h = fixture({ apps: [], personalApps: [{ id: APP_ID, name: 'Teacher Studio', last_build_id: null }] });
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.match(result.error.message, /app|repository|build|verify|Codemagic/i);
  assert.equal(h.posts().length, 0);
});

test('a personal app can bind through its verified previous-build GitHub commit URL', async () => {
  const previous = build('previous-build', 'finished', { commit: OTHER_COMMIT });
  const h = fixture({ apps: [], personalApps: [{ id: APP_ID, name: 'Any display name', last_build_id: previous.id }], builds: [previous] });
  const result = await h.launch();
  assert.equal(result.appId, APP_ID);
  assert.equal(h.posts().length, 1);
  assertTargeted(h.posts()[0]);
});

test('no matching app yields a useful error without a guessed POST', async () => {
  const h = fixture({ apps: [], personalApps: [] });
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.match(result.error.message, /app|repository|Codemagic/i);
  assert.equal(h.posts().length, 0);
});

test('a failed API discovery aborts before trigger and strips transport secrets from exposed errors', async () => {
  const h = fixture();
  h.getError = Object.assign(new Error('Fixture upstream echoed ' + TOKEN), { status: 401 });
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.equal(h.posts().length, 0);
  assert.ok(!h.writes.some(entry => entry.value.phase === 'starting'));
  safeObservables(h, result.error);
});

test('the injected masked-token prompt is used when no token environment variable exists, without persisting its answer', async () => {
  const h = fixture();
  h.deps.env = {};
  await h.launch();
  assert.equal(h.promptCalls, 1);
  assert.equal(h.posts().length, 1);
  safeObservables(h);
});

test('failure to persist the starting marker prevents the POST', async () => {
  const h = fixture();
  h.failStartingWrite = true;
  const result = await outcome(() => h.launch());
  assert.ok(result.error);
  assert.equal(h.posts().length, 0);
});

for (const [label, error] of [
  ['timeout', new Error('Fixture timed out after sending ' + TOKEN)],
  ['HTTP 503', Object.assign(new Error('Fixture server failed after receiving ' + TOKEN), { status: 503 })],
]) test(`${label} after POST remains uncertain and is never automatically posted again`, async () => {
  const h = fixture();
  h.postError = error;
  const first = await outcome(() => h.launch());
  assert.ok(first.error);
  assert.equal(h.posts().length, 1, 'An ambiguous POST must not be retried within the initial run.');
  assert.equal(h.state().phase, 'uncertain');
  safeObservables(h, first.error);
  h.postError = null;
  const second = await outcome(() => h.launch());
  assert.equal(h.posts().length, 1, 'An unresolved previous attempt must not be reposted on rerun.');
  assert.ok(second.error || second.value?.phase === 'unknown');
  safeObservables(h, second.error);
});

for (const [status, phase] of [['building', 'active'], ['finished', 'success']]) test(`rerunning the same ${status} build avoids a duplicate build`, async () => {
  const h = fixture();
  await h.launch();
  h.builds.get(BUILD_ID).status = status;
  const result = await h.launch();
  assert.equal(h.posts().length, 1);
  assert.equal(result.buildId, BUILD_ID);
  assert.equal(result.phase, phase);
});

for (const status of ['queued', 'future-status']) test(`an existing ${status} build without commit metadata blocks a new uncorrelated request`, async () => {
  const pending = build(BUILD_ID, status);
  pending.commit = null;
  const h = fixture({ builds: [pending] });
  const result = await outcome(() => h.launch());
  assert.ok(result.error || result.value?.phase === 'unknown');
  assert.equal(h.posts().length, 0, 'Without a saved ID or matching attempt label, the pending build cannot be ruled out as a duplicate.');
});

test('an accepted build whose detail lookup returns 404 remains pending without a duplicate request', async () => {
  const h = fixture();
  await h.launch();
  h.builds.delete(BUILD_ID);
  for (const launch of [() => run({ statusOnly: true }, h.deps), () => h.launch({ retryFailed: true })]) {
    const result = await outcome(launch);
    assert.ok(result.error || result.value?.phase === 'unknown');
    assert.equal(h.posts().length, 1);
    assert.equal(h.state().buildId, BUILD_ID);
    assert.equal(h.state().phase, 'accepted');
  }
});

test('a definite POST 404 rejection is saved distinctly and may be retried after its cause is corrected', async () => {
  const h = fixture();
  h.postError = Object.assign(new Error('Fixture target rejected ' + TOKEN), { status: 404 });
  const rejected = await outcome(() => h.launch());
  assert.ok(rejected.error);
  assert.equal(h.posts().length, 1);
  assert.equal(h.state().phase, 'rejected');
  safeObservables(h, rejected.error);
  h.postError = null;
  const result = await h.launch();
  assert.equal(h.posts().length, 2);
  assert.equal(result.started, true);
  assertTargeted(h.posts()[1]);
});

for (const status of ['failed', 'canceled']) test(`a ${status} build requires an explicit retry and then starts only one new attempt`, async () => {
  const h = fixture();
  await h.launch();
  h.builds.get(BUILD_ID).status = status;
  const stopped = await outcome(() => h.launch());
  assert.equal(h.posts().length, 1, 'An ordinary rerun does not silently restart a failed or canceled build.');
  assert.ok(stopped.error || stopped.value?.phase === 'failed');
  const retried = await h.launch({ retryFailed: true });
  assert.equal(h.posts().length, 2);
  assertTargeted(h.posts()[1]);
  assert.notEqual(retried.buildId, BUILD_ID);
  assert.notDeepEqual(h.posts()[0].body.labels, h.posts()[1].body.labels, 'A deliberate retry receives its own reconciliation label.');
});

for (const mode of ['status', 'retry']) test(`${mode} preserves an uncertain retry when only the old failed build is visible`, async () => {
  const h = fixture();
  await h.launch();
  h.builds.get(BUILD_ID).status = 'failed';
  h.postError = new Error('Fixture timed out after accepting the retry.');
  const uncertain = await outcome(() => h.launch({ retryFailed: true }));
  assert.ok(uncertain.error);
  assert.equal(h.posts().length, 2);
  const pending = h.state();
  assert.equal(pending.phase, 'uncertain');
  assert.notDeepEqual(h.posts()[0].body.labels, h.posts()[1].body.labels);
  h.postError = null;
  const checked = await outcome(() => mode === 'status'
    ? run({ statusOnly: true }, h.deps)
    : h.launch({ retryFailed: true }));
  assert.equal(h.posts().length, 2, 'An unresolved retry must not cause a third POST.');
  assert.equal(h.state().phase, 'uncertain', 'The older failed build must not replace the newer uncertain attempt.');
  assert.equal(h.state().attemptLabel, pending.attemptLabel);
  assert.ok(!h.state().buildId, 'The previous failed build ID must not be attached to the new attempt.');
  assert.ok(checked.error || checked.value?.phase === 'unknown');
});

test('an uncertain request recovers its own labeled queued build before commit metadata is available', async () => {
  const h = fixture();
  h.postError = new Error('Fixture start response was lost.');
  await outcome(() => h.launch());
  const queued = build(BUILD_ID, 'queued', { labels: clone(h.posts()[0].body.labels) });
  queued.commit = null;
  h.builds.set(BUILD_ID, queued);
  h.postError = null;
  const pending = h.state();
  const result = await run({ statusOnly: true }, h.deps);
  assert.equal(h.posts().length, 1);
  assert.equal(result.buildId, BUILD_ID);
  assert.equal(result.phase, 'active');
  assert.equal(result.status, 'queued');
  assert.equal(result.url, `https://codemagic.io/app/${APP_ID}/build/${BUILD_ID}`);
  assert.deepEqual(h.state(), pending, 'Checkout-free status recovery must not overwrite a concurrent launch or retry record.');
});

test('mismatched saved repository and app data cannot select or report another project as the target', async () => {
  const h = fixture({ apps: [app(), app(SECOND_APP_ID, 'https://github.com/someone/another-app.git')] });
  await h.launch();
  const bad = h.state();
  bad.repository = 'someone/another-app';
  bad.appId = SECOND_APP_ID;
  h.records.set(COMMIT, bad);
  const result = await outcome(() => h.launch());
  if (result.value) assert.equal(result.value.appId, APP_ID);
  for (const post of h.posts()) assertTargeted(post);
});

test('cached build ID with a conflicting API app or commit cannot be treated as the requested build', async () => {
  const h = fixture();
  await h.launch();
  h.builds.set(BUILD_ID, build(BUILD_ID, 'building', { appId: SECOND_APP_ID, commit: OTHER_COMMIT }));
  const result = await outcome(() => h.launch());
  assert.ok(result.error || result.value?.phase === 'unknown', 'Conflicting API identity must stop reconciliation.');
  assert.equal(h.posts().length, 1);
});

test('status can inspect the latest saved build without querying or requiring the temporary checkout', async () => {
  const h = fixture();
  await h.launch();
  h.builds.get(BUILD_ID).status = 'publishing';
  const gitCount = h.gitCalls.length;
  const result = await run({ statusOnly: true }, h.deps);
  assert.equal(h.gitCalls.length, gitCount);
  assert.equal(h.posts().length, 1);
  assert.equal(result.buildId, BUILD_ID);
  assert.equal(result.phase, 'active');
  safeObservables(h);
});
