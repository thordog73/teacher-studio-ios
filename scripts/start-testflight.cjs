'use strict';

// Built-ins only. UPDATE.cmd has already pushed; this helper never pushes Git,
// changes a Codemagic app, or stores an API token.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPOSITORY = 'thordog73/teacher-studio-ios';
const WORKFLOW = 'ios-testflight';
const BRANCH = 'main';
const BUNDLE_ID = 'com.frontofus.teacherstudio';
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const ID = /^[a-zA-Z0-9_-]{1,100}$/;

function problem(code, message) {
  return Object.assign(new Error(message), {code});
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--checkout' && !options.checkout && argv[i + 1] && !argv[i + 1].startsWith('--')) options.checkout = argv[++i];
    else if (argv[i] === '--status') options.statusOnly = true;
    else if (argv[i] === '--retry') options.retryFailed = true;
    else throw problem('ARGUMENTS', 'Use UPDATE.cmd, UPDATE.cmd --status, or UPDATE.cmd --retry.');
  }
  if (options.statusOnly && options.retryFailed) throw problem('ARGUMENTS', 'Choose --status or --retry, not both.');
  if (!options.checkout && !options.statusOnly) throw problem('ARGUMENTS', 'A pushed checkout is required. Run UPDATE.cmd from the extracted build.');
  return options;
}

function normalizeRepositoryUrl(value) {
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (/^git@github\.com:/i.test(text)) text = text.replace(/^git@github\.com:/i, 'ssh://git@github.com/');
  try {
    const url = new URL(text);
    if (url.hostname.toLowerCase() !== 'github.com' || url.search || url.hash || url.password) return null;
    if (url.protocol === 'https:') {
      if (url.username || url.port) return null;
    } else if (url.protocol === 'ssh:') {
      if (url.username !== 'git' || (url.port && url.port !== '22')) return null;
    } else return null;
    const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)\/?$/);
    if (!match) return null;
    return `${match[1]}/${match[2].replace(/\.git$/i, '')}`.toLowerCase();
  } catch { return null; }
}

function commitRepository(commit) {
  if (!commit || !SHA.test(commit.hash || '') || typeof commit.url !== 'string') return null;
  try {
    const url = new URL(commit.url);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/commit\/([a-f0-9]{40}|[a-f0-9]{64})\/?$/i);
    if (!match || match[3].toLowerCase() !== commit.hash.toLowerCase()) return null;
    return `${match[1]}/${match[2]}`.toLowerCase();
  } catch { return null; }
}

function selectApp(apps, repository = REPOSITORY, selectedId) {
  const matches = apps.filter(app => !app.archived && (app.repository && Object.hasOwn(app.repository, 'url')
    ? normalizeRepositoryUrl(app.repository.url) === repository
    : app.verifiedRepository === repository));
  if (selectedId) {
    const selected = matches.find(app => app.id === selectedId);
    if (!selected) throw problem('APP_BINDING', 'CM_APP_ID / CODEMAGIC_APP_ID does not identify an accessible app verified for teacher-studio-ios.');
    return selected;
  }
  if (!matches.length) throw problem('APP_NOT_FOUND', 'No accessible existing Codemagic app could be verified for thordog73/teacher-studio-ios. Check that the API token belongs to the account or team used for this app. No app was created.');
  if (matches.length !== 1) throw problem('APP_AMBIGUOUS', 'More than one Codemagic app is verified for teacher-studio-ios. Set CM_APP_ID to the intended existing app ID, then rerun UPDATE.cmd.');
  return matches[0];
}

function buildStatus(build) {
  const status = typeof build?.status === 'string' ? build.status.toLowerCase() : '';
  return ['initializing', 'queued', 'preparing', 'fetching', 'testing', 'building', 'publishing', 'finishing', 'finished', 'failed', 'canceled', 'timeout', 'skipped'].includes(status) ? status : 'unknown';
}

function classifyBuild(build) {
  const status = buildStatus(build);
  if (['initializing', 'queued', 'preparing', 'fetching', 'testing', 'building', 'publishing', 'finishing'].includes(status)) return 'active';
  if (status === 'finished') return 'success';
  if (['failed', 'canceled', 'timeout', 'skipped'].includes(status)) return 'failed';
  return 'unknown';
}

function buildUrl(appId, buildId) {
  return `https://codemagic.io/app/${encodeURIComponent(appId)}/build/${encodeURIComponent(buildId)}`;
}

async function defaultGit(args, {cwd}) {
  const {execFile} = require('node:child_process');
  return new Promise((resolve, reject) => {
    execFile('git', args, {cwd, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 2 * 1024 * 1024}, (error, stdout) => {
      if (error) reject(problem('GIT', 'Git verification failed. Check GitHub access and run UPDATE.cmd again.'));
      else resolve(stdout);
    });
  });
}

async function defaultRequest({method, path: apiPath, token, body}) {
  const origin = apiPath.startsWith('/api/v3/') ? 'https://codemagic.io' : 'https://api.codemagic.io';
  if (!(apiPath.startsWith('/api/v3/') || apiPath === '/builds')) throw problem('API_PATH', 'Unexpected Codemagic endpoint.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(origin + apiPath, {
      method, redirect: 'error', signal: controller.signal,
      headers: {'x-auth-token': token, Accept: 'application/json', ...(body ? {'Content-Type': 'application/json'} : {})},
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(problem('API_HTTP', `Codemagic returned HTTP ${response.status}.`), {status: response.status});
    }
    try { return await response.json(); }
    catch { throw problem('API_RESPONSE', 'Codemagic returned an unreadable response.'); }
  } catch (error) {
    if (error.code === 'API_HTTP' || error.code === 'API_RESPONSE') throw error;
    throw problem('API_NETWORK', 'Codemagic could not be reached or the request timed out.');
  } finally { clearTimeout(timer); }
}

async function promptToken() {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') throw problem('TOKEN_REQUIRED', 'Set CM_API_TOKEN, CODEMAGIC_API_TOKEN, or CODEMAGIC_TOKEN in this CMD session, or run UPDATE.cmd in an interactive Command Prompt for a hidden token prompt.');
  output.write('Codemagic API token (hidden; not saved): ');
  return new Promise((resolve, reject) => {
    const wasRaw = input.isRaw;
    let secret = '';
    const finish = (error) => {
      input.removeListener('data', onData);
      input.removeListener('error', onError);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      output.write('\n');
      if (error) reject(error); else resolve(secret.trim());
      secret = '';
    };
    const onError = () => finish(problem('TOKEN_INPUT', 'The hidden token prompt could not be read.'));
    const onData = chunk => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0003' || character === '\u0004') return finish(problem('CANCELED', 'Token entry canceled. No build request was sent.'));
        if (character === '\b' || character === '\u007f') secret = secret.slice(0, -1);
        else if (character >= ' ' && character !== '\u007f' && secret.length < 8192) secret += character;
      }
    };
    input.setRawMode(true);
    input.on('data', onData);
    input.once('error', onError);
    input.resume();
  });
}

function createStateStore(env = process.env) {
  const base = env.LOCALAPPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Local') : (env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state')));
  const directory = path.join(base, 'TeacherStudio', 'codemagic');
  const filename = key => {
    if (key !== 'latest' && !SHA.test(key)) throw problem('STATE_KEY', 'Invalid local build-state identifier.');
    return path.join(directory, `${key}.json`);
  };
  return {
    async read(key) {
      try { return JSON.parse(await fs.readFile(filename(key), 'utf8')); }
      catch (error) {
        if (error.code === 'ENOENT') return null;
        throw problem('STATE_READ', 'Saved build status could not be read. No new build will be started until the local status file is repaired.');
      }
    },
    async write(key, value) {
      await fs.mkdir(directory, {recursive: true, mode: 0o700});
      const destination = filename(key);
      const temporary = `${destination}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      let handle;
      try {
        handle = await fs.open(temporary, 'wx', 0o600);
        await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
        await handle.sync();
        await handle.close();
        handle = null;
        await fs.rename(temporary, destination);
      } finally {
        if (handle) await handle.close();
        await fs.unlink(temporary).catch(() => {});
      }
    },
    async withLock(key, action) {
      await fs.mkdir(directory, {recursive: true, mode: 0o700});
      const lock = filename(key) + '.lock';
      let handle;
      try { handle = await fs.open(lock, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') throw problem('LOCKED', `Another launcher may still be running. Use UPDATE.cmd --status. If a previous launcher was interrupted, close it before removing its lock file: ${lock}`);
        throw problem('STATE_LOCK', 'The local request lock could not be created. No build was started.');
      }
      try {
        await handle.writeFile(JSON.stringify({pid: process.pid, createdAt: new Date().toISOString()}));
        await handle.sync();
        return await action();
      } finally {
        await handle.close();
        await fs.unlink(lock).catch(() => {});
      }
    }
  };
}

function validState(record, commit) {
  if (!record) return null;
  if (record.version !== 1 || record.repository !== REPOSITORY || record.workflowId !== WORKFLOW || record.branch !== BRANCH || record.commit !== commit || !ID.test(record.appId || '') || !['starting', 'uncertain', 'accepted', 'rejected', 'terminal'].includes(record.phase) || (record.buildId && !ID.test(record.buildId))) throw problem('STATE_INVALID', 'Saved build status does not match this Teacher Studio commit. No new build was started.');
  return record;
}

async function run(options = {}, deps = {}) {
  const env = deps.env || process.env;
  const git = deps.git || defaultGit;
  const request = deps.request || defaultRequest;
  const stateStore = deps.stateStore || createStateStore(env);
  const log = deps.log || console.log;
  const now = deps.now || (() => new Date().toISOString());
  const getToken = deps.promptToken || promptToken;
  let token;
  const read = async key => {
    try { return await stateStore.read(key); }
    catch { throw problem('STATE_READ', 'Saved build status could not be read. No new request was sent.'); }
  };
  const write = async (key, value) => {
    try { await stateStore.write(key, value); }
    catch { throw problem('STATE_WRITE', 'Build status could not be saved locally. No automatic retry will be made.'); }
  };
  const authenticate = async () => {
    token = [env.CM_API_TOKEN, env.CODEMAGIC_API_TOKEN, env.CODEMAGIC_TOKEN].find(value => typeof value === 'string' && value.trim())?.trim() || await getToken();
    if (typeof token !== 'string' || !token.trim() || /[\x00-\x20\x7f]/.test(token)) throw problem('TOKEN_INVALID', 'Enter a nonempty Codemagic API token without spaces or line breaks.');
    token = token.trim();
  };
  const get = async apiPath => {
    try { return await request({method: 'GET', path: apiPath, token}); }
    catch (error) {
      const hint = [401, 403].includes(error.status) ? 'Check the API token and its access to the existing app/team.' : 'Check the connection and rerun UPDATE.cmd --status.';
      throw Object.assign(problem('API_READ', `Codemagic status could not be read${error.status ? ` (HTTP ${Number(error.status)})` : ''}. ${hint} No new request was sent.`), {status: error.status});
    }
  };
  const classicPages = async endpoint => {
    const all = [];
    for (let page = 1; page <= 100; page++) {
      const response = await get(`${endpoint}?page_size=100&page=${page}`);
      if (!Array.isArray(response?.data) || !Number.isInteger(response.total_pages) || response.total_pages < 0) throw problem('API_SHAPE', 'Codemagic returned an unexpected app/team list. No new build was started.');
      all.push(...response.data);
      if (page >= response.total_pages) return all;
    }
    throw problem('API_PAGINATION', 'The Codemagic app list was too large to verify completely. No new build was started.');
  };
  const getBuild = async id => {
    if (!ID.test(id || '')) throw problem('BUILD_ID', 'The saved Codemagic build ID is invalid.');
    const response = await get(`/api/v3/builds/${encodeURIComponent(id)}`);
    if (!response?.data || response.data.id !== id) throw problem('API_SHAPE', 'Codemagic returned an unexpected build record. No new build was started.');
    return response.data;
  };
  const discover = async () => {
    const applications = new Map();
    const teams = await classicPages('/api/v3/user/teams');
    for (const team of teams) {
      if (!ID.test(team.id || '')) throw problem('API_SHAPE', 'Codemagic returned an invalid team ID.');
      for (const app of await classicPages(`/api/v3/teams/${encodeURIComponent(team.id)}/apps`)) {
        if (!ID.test(app.id || '')) throw problem('API_SHAPE', 'Codemagic returned an invalid app ID.');
        applications.set(app.id, {...app, teamId: team.id});
      }
    }
    for (const app of await classicPages('/api/v3/user/apps')) {
      if (!ID.test(app.id || '')) throw problem('API_SHAPE', 'Codemagic returned an invalid app ID.');
      if (applications.has(app.id) || app.archived || !app.last_build_id) continue;
      const previous = await getBuild(app.last_build_id);
      if (previous.app_id === app.id && commitRepository(previous.commit) === REPOSITORY) applications.set(app.id, {...app, verifiedRepository: REPOSITORY, previousBuild: previous});
    }
    const selectedId = env.CM_APP_ID || env.CODEMAGIC_APP_ID;
    if (selectedId && !ID.test(selectedId)) throw problem('APP_ID', 'CM_APP_ID / CODEMAGIC_APP_ID is not a valid existing app identifier.');
    return selectApp([...applications.values()], REPOSITORY, selectedId);
  };
  const sameBuild = (build, appId, commit, record) => {
    if (build.app_id !== appId || build.workflow?.id !== WORKFLOW || build.branch !== BRANCH) return false;
    const carriesAttempt = Boolean(record?.attemptLabel && Array.isArray(build.labels) && build.labels.includes(record.attemptLabel));
    // A timed-out retry must never be "recovered" as an older failed build of
    // the same commit. Only this specific request's label can settle it.
    if (record && !record.buildId && ['starting', 'uncertain'].includes(record.phase) && !carriesAttempt) return false;
    if (build.commit?.hash) return build.commit.hash.toLowerCase() === commit;
    return carriesAttempt || Boolean(record?.buildId && record.buildId === build.id);
  };
  const recent = async (app, commit, record) => {
    if (!app.teamId) {
      let build = app.previousBuild;
      if (!build && app.last_build_id) build = await getBuild(app.last_build_id);
      return build && sameBuild(build, app.id, commit, record) ? [build] : [];
    }
    const all = [];
    let cursor = null;
    const cursors = new Set();
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({app_id: app.id, workflow_id: WORKFLOW, branch: BRANCH, page_size: '100'});
      if (cursor) query.set('cursor', cursor);
      const response = await get(`/api/v3/teams/${encodeURIComponent(app.teamId)}/builds?${query}`);
      if (!Array.isArray(response?.data) || !(response.cursor === null || typeof response.cursor === 'string')) throw problem('API_SHAPE', 'Codemagic returned an unexpected build list. No new build was started.');
      const unidentified = response.data.find(build => build.app_id === app.id && build.workflow?.id === WORKFLOW && (build.branch === BRANCH || build.branch == null) && !build.commit?.hash && ['active', 'unknown'].includes(classifyBuild(build)) && !sameBuild(build, app.id, commit, record));
      if (unidentified) throw problem('BUILD_IDENTITY_PENDING', 'An existing ios-testflight build has not reported its commit yet. Wait for its status to update, then rerun UPDATE.cmd. No duplicate request was sent.');
      all.push(...response.data.filter(build => sameBuild(build, app.id, commit, record)));
      if (!response.cursor) return all;
      if (cursors.has(response.cursor)) break;
      cursors.add(response.cursor);
      cursor = response.cursor;
    }
    throw problem('API_PAGINATION', 'The existing builds could not be checked completely. No new build was started.');
  };
  const report = (record, build, started = false) => {
    const phase = started ? 'accepted' : classifyBuild(build);
    const status = started ? 'accepted' : buildStatus(build);
    const url = buildUrl(record.appId, record.buildId);
    log(started ? `Codemagic accepted ${WORKFLOW} for ${record.commit.slice(0, 12)}.` : `Codemagic build status: ${status}.`);
    log(`Build: ${url}`);
    if (phase === 'accepted' || phase === 'active') log('Signing, TestFlight upload, and Apple processing run after this request; acceptance is not an Apple upload confirmation.');
    if (phase === 'failed') log('After correcting the build problem, run UPDATE.cmd --retry to request another build of this commit.');
    if (phase === 'unknown') log('The build status is not recognized yet. Run UPDATE.cmd --status; no duplicate request was sent.');
    return {started, phase, commit: record.commit, appId: record.appId, buildId: record.buildId, url, status, exitCode: phase === 'failed' || phase === 'unknown' ? 2 : 0};
  };
  const checkSaved = async record => {
    let build;
    try { build = await getBuild(record.buildId); }
    catch (error) {
      if (error.status === 404) {
        log(`Build: ${buildUrl(record.appId, record.buildId)}`);
        throw problem('BUILD_PENDING', 'The accepted build is not visible in the status API yet. Run UPDATE.cmd --status later. No duplicate request was sent.');
      }
      throw error;
    }
    if (build.app_id !== record.appId || build.workflow?.id !== WORKFLOW || build.branch !== BRANCH) throw problem('BUILD_MISMATCH', 'The saved build does not match the expected app, workflow, and branch. No new request was sent.');
    if (build.commit?.hash && build.commit.hash.toLowerCase() !== record.commit) throw problem('BUILD_COMMIT_MISMATCH', `Codemagic fetched a different commit. The expected-commit workflow check must stop it. Inspect ${buildUrl(record.appId, record.buildId)}; no duplicate request was sent.`);
    return build;
  };

  if (options.statusOnly && !options.checkout) {
    const latest = await read('latest');
    if (!latest || !SHA.test(latest.commit || '')) throw problem('NO_SAVED_BUILD', 'No saved Teacher Studio build request was found. Run UPDATE.cmd from the extracted build first.');
    const record = validState(await read(latest.commit), latest.commit);
    if (!record) throw problem('NO_SAVED_BUILD', 'The latest build request has no saved status. Run UPDATE.cmd from the extracted build.');
    await authenticate();
    if (record.buildId) return report(record, await checkSaved(record));
    const app = await discover();
    if (app.id !== record.appId) throw problem('APP_STATE_MISMATCH', 'The saved request belongs to a different Codemagic app. No new request was sent.');
    const builds = await recent(app, record.commit, record);
    const matching = builds.find(build => classifyBuild(build) === 'success') || builds.find(build => classifyBuild(build) === 'active') || builds[0];
    if (matching) {
      const recovered = {...record, phase: 'accepted', buildId: matching.id, updatedAt: now()};
      return report(recovered, matching);
    }
    throw problem('START_UNCERTAIN', 'The previous request has not been confirmed. No automatic retry was sent. Run UPDATE.cmd --status later; this protects against a duplicate build.');
  }

  if (!options.checkout) throw problem('CHECKOUT_REQUIRED', 'Run UPDATE.cmd to provide the verified pushed checkout.');
  const checkout = path.resolve(options.checkout);
  let remote, commit, remoteMain, configText, workflowText;
  try {
    remote = String(await git(['remote', 'get-url', 'origin'], {cwd: checkout})).trim();
    if (normalizeRepositoryUrl(remote) !== REPOSITORY) throw problem('REPOSITORY', 'This checkout does not use the expected teacher-studio-ios origin. No build was started.');
    commit = String(await git(['rev-parse', 'HEAD'], {cwd: checkout})).trim().toLowerCase();
    if (!SHA.test(commit)) throw problem('COMMIT', 'Git did not return a complete commit ID.');
    remoteMain = String(await git(['ls-remote', '--exit-code', 'origin', 'refs/heads/main'], {cwd: checkout})).trim();
    const line = remoteMain.split(/\r?\n/).find(value => value.split(/\s+/)[1] === 'refs/heads/main');
    if (!line || line.split(/\s+/)[0].toLowerCase() !== commit) throw problem('REMOTE_COMMIT', 'Local HEAD does not match GitHub main. Run UPDATE.cmd again before starting a build.');
    configText = await git(['show', `${commit}:capacitor.config.json`], {cwd: checkout});
    workflowText = await git(['show', `${commit}:codemagic.yaml`], {cwd: checkout});
  } catch (error) {
    if (['REPOSITORY', 'COMMIT', 'REMOTE_COMMIT'].includes(error.code)) throw error;
    throw problem('GIT', 'Could not verify the pushed GitHub commit and its configuration. Run UPDATE.cmd again after checking GitHub access.');
  }
  let config;
  try { config = JSON.parse(configText); } catch { throw problem('BUNDLE', 'The committed Capacitor configuration is unreadable.'); }
  if (config.appId !== BUNDLE_ID) throw problem('BUNDLE', 'The committed Capacitor bundle identifier is not com.frontofus.teacherstudio. No build was started.');
  if (!/^  ios-testflight:\s*$/m.test(workflowText)) throw problem('WORKFLOW', 'The committed codemagic.yaml does not contain the ios-testflight workflow.');
  await authenticate();
  const app = await discover();
  if (app.verifiedRepository && !app.repository?.url) log('Existing personal Codemagic app matched by its recorded GitHub commit URL.');

  const perform = async () => {
    let record = validState(await read(commit), commit);
    if (record && record.appId !== app.id) throw problem('APP_STATE_MISMATCH', 'A saved request for this commit belongs to another Codemagic app. No new build was started.');
    let existing;
    if (record?.buildId) existing = await checkSaved(record);
    const builds = await recent(app, commit, record);
    existing = builds.find(build => classifyBuild(build) === 'success') || builds.find(build => classifyBuild(build) === 'active') || existing || builds[0];
    if (existing) {
      record = {...(record || {}), version: 1, repository: REPOSITORY, workflowId: WORKFLOW, branch: BRANCH, commit, appId: app.id, ...(app.teamId ? {teamId: app.teamId} : {}), buildId: existing.id, phase: 'accepted', lastStatus: buildStatus(existing), updatedAt: now(), createdAt: record?.createdAt || now()};
      if (!options.statusOnly) {
        await write(commit, record);
        await write('latest', {commit});
      }
      if (classifyBuild(existing) !== 'failed' || !options.retryFailed || options.statusOnly) return report(record, existing);
    } else if (record && ['starting', 'uncertain', 'accepted'].includes(record.phase)) {
      throw problem('START_UNCERTAIN', 'A previous start request for this commit is unconfirmed. Run UPDATE.cmd --status later. No automatic retry was sent.');
    }
    if (options.statusOnly) {
      log('No TestFlight request was found for this commit. No build was started.');
      return {started: false, phase: 'not-started', commit, appId: app.id, exitCode: 0};
    }
    const attemptLabel = `teacher-studio-${commit.slice(0, 12)}-${crypto.randomBytes(8).toString('hex')}`;
    record = {version: 1, repository: REPOSITORY, workflowId: WORKFLOW, branch: BRANCH, commit, appId: app.id, ...(app.teamId ? {teamId: app.teamId} : {}), phase: 'starting', attemptLabel, createdAt: now(), updatedAt: now()};
    await write('latest', {commit});
    await write(commit, record);
    let response;
    try {
      response = await request({method: 'POST', path: '/builds', token, body: {appId: app.id, workflowId: WORKFLOW, branch: BRANCH, labels: [attemptLabel], environment: {variables: {TEACHER_STUDIO_EXPECTED_COMMIT: commit}}}});
      if (!ID.test(response?.buildId || '')) throw problem('START_RESPONSE', 'The start response did not contain a build ID.');
    } catch (error) {
      const rejected = [400, 401, 403, 404, 422].includes(error.status);
      await write(commit, {...record, phase: rejected ? 'rejected' : 'uncertain', updatedAt: now(), ...(Number.isInteger(error.status) ? {httpStatus: error.status} : {})});
      if (rejected) throw problem('START_REJECTED', `Codemagic rejected the request (HTTP ${error.status}). Check the token, app access, and workflow configuration, then rerun UPDATE.cmd.`);
      throw problem('START_UNCERTAIN', 'Codemagic did not confirm whether it accepted the request. Its nonsecret request record was retained. Run UPDATE.cmd --status later; do not erase the record to force another build.');
    }
    record = {...record, phase: 'accepted', buildId: response.buildId, updatedAt: now()};
    try { await write(commit, record); }
    catch {
      log(`Build: ${buildUrl(app.id, response.buildId)}`);
      throw problem('STATE_AFTER_START', 'Codemagic accepted the request, but its returned ID could not be saved. The starting marker remains. Run UPDATE.cmd --status; no automatic retry was sent.');
    }
    return report(record, null, true);
  };
  if (options.statusOnly || !stateStore.withLock) return perform();
  return stateStore.withLock(commit, perform);
}

module.exports = {run, parseArgs, normalizeRepositoryUrl, selectApp, classifyBuild, createStateStore, REPOSITORY, WORKFLOW, BRANCH, BUNDLE_ID};

if (require.main === module) {
  Promise.resolve().then(() => {
    if (Number(process.versions.node.split('.')[0]) < 18) throw problem('NODE_VERSION', 'Install Node.js 18 or later, then run UPDATE.cmd again.');
    return run(parseArgs(process.argv.slice(2)));
  }).then(result => { process.exitCode = result.exitCode || 0; }).catch(error => {
    console.error(`TESTFLIGHT LAUNCHER: ${error.code ? error.message : 'The operation could not complete. No automatic retry was made.'}`);
    process.exitCode = error.code === 'CANCELED' ? 130 : 1;
  });
}
