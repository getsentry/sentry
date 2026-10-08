import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {parse} from 'yaml';

import {EXACT_BUDGETS_STEP, findVerifiedLintBase} from './find-verified-lint-base.js';

function fixture(t, changed = 'src/example.py') {
  const original = process.cwd();
  const directory = mkdtempSync(path.join(tmpdir(), 'verified-lint-base-'));
  t.after(() => {
    process.chdir(original);
    rmSync(directory, {recursive: true, force: true});
  });
  process.chdir(directory);
  const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();
  const write = (file, contents) => {
    mkdirSync(path.dirname(file), {recursive: true});
    writeFileSync(file, contents);
  };
  const commit = () => {
    git('add', '.');
    git('commit', '--quiet', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  git('init', '--quiet');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgSign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  write('source.ts', 'export {};');
  write('oxlint-suppressions.json', '{}');
  const verified = commit();
  write(changed, 'changed');
  const base = commit();
  write('source.ts', 'export const value = 1;');
  const head = commit();
  const run = {id: 1, head_sha: verified, event: 'push', head_branch: 'master'};
  const job = {
    name: 'oxlint',
    head_sha: verified,
    steps: [
      {name: 'Verify lint ratchet', conclusion: 'success'},
      {name: EXACT_BUDGETS_STEP, conclusion: 'success'},
    ],
  };
  const runs = [run];
  const jobs = [job];
  const jobRequests = [];
  const github = {
    rest: {
      actions: {
        async listWorkflowRuns(args) {
          assert.equal(args.workflow_id, 'frontend.yml');
          assert.equal(args.branch, 'master');
          assert.equal(args.event, 'push');
          assert.equal(args.per_page, 100);
          return {data: {workflow_runs: runs}};
        },
        async listJobsForWorkflowRun(args) {
          jobRequests.push(args.run_id);
          return {data: {jobs}};
        },
      },
    },
  };
  const find = () =>
    findVerifiedLintBase({
      github,
      context: {repo: {owner: 'example', repo: 'example'}},
      core: {info() {}},
    });
  return {
    git,
    write,
    commit,
    verified,
    base,
    head,
    run,
    job,
    runs,
    jobs,
    jobRequests,
    github,
    find,
  };
}

test('reuses ancestor validation across backend Python changes', async t => {
  const {base, run, find} = fixture(t);
  run.conclusion = 'failure';
  assert.equal(await find(), base);
});

test('accepts successful validation on the exact base commit', async t => {
  const {base, run, job, find} = fixture(t);
  run.head_sha = base;
  job.head_sha = base;
  assert.equal(await find(), base);
});

test('changed source, assets, configuration, or budgets invalidate ancestor proof', async t => {
  for (const file of [
    'source.ts',
    'types.d.ts',
    'data.json',
    'logo.svg',
    '.gitignore',
    'pnpm-lock.yaml',
    'oxlint-suppressions.json',
    '.github/workflows/frontend.yml',
    'static/oxlint/rule.py',
  ]) {
    await t.test(file, async subtest => {
      const {find, jobRequests} = fixture(subtest, file);
      assert.equal(await find(), '');
      assert.deepEqual(jobRequests, []);
    });
  }
});

test('a skipped, failed, missing, or unrelated verification cannot certify the base', async t => {
  const {run, job, find} = fixture(t);
  for (const conclusion of ['skipped', 'failure', null]) {
    job.steps[1].conclusion = conclusion;
    assert.equal(await find(), '');
  }
  job.steps = [{name: 'oxlint (all files)', conclusion: 'success'}];
  assert.equal(await find(), '');
  job.steps = [{name: EXACT_BUDGETS_STEP, conclusion: 'success'}];
  job.head_sha = '0'.repeat(40);
  assert.equal(await find(), '');
  job.head_sha = run.head_sha;
  run.event = 'pull_request';
  assert.equal(await find(), '');
  run.event = 'push';
  run.head_branch = 'feature';
  assert.equal(await find(), '');
});

test('a passing ratchet with stale budgets cannot certify the base', async t => {
  const {job, find} = fixture(t);
  job.steps[1].conclusion = 'skipped';
  assert.equal(await find(), '');
  job.steps = [{name: 'Verify lint ratchet', conclusion: 'success'}];
  assert.equal(await find(), '');
});

test('the workflow only reports exact budgets after the ratchet reports them', () => {
  const workflow = parse(
    readFileSync(new URL('../frontend.yml', import.meta.url), 'utf8')
  );
  const steps = workflow.jobs.oxlint.steps;
  const ratchet = steps.findIndex(step => step.name === 'Verify lint ratchet');
  const exact = steps.findIndex(step => step.name === EXACT_BUDGETS_STEP);
  assert(ratchet >= 0 && exact > ratchet);
  assert.equal(steps[ratchet].id, 'ratchet');
  assert.match(steps[ratchet].run, /pnpm run lint:js --ci/);
  assert.equal(steps[exact].if, "steps.ratchet.outputs.budgets == 'exact'");
});

test('renaming a lint input to a backend path invalidates ancestor proof', async t => {
  const {git, base, write, commit, find} = fixture(t);
  git('checkout', '--quiet', '--detach', base);
  git('mv', 'source.ts', 'src/renamed.py');
  commit();
  write('pr.ts', 'export {};');
  commit();
  assert.equal(await find(), '');
});

test('non-ancestors and missing Git objects cannot certify the base', async t => {
  const {git, write, commit, verified, head, run, job, find} = fixture(t);
  git('checkout', '--quiet', '--detach', verified);
  write('src/side.py', 'side');
  const side = commit();
  git('checkout', '--quiet', '--detach', head);
  for (const sha of [side, '0'.repeat(40)]) {
    run.head_sha = sha;
    job.head_sha = sha;
    assert.equal(await find(), '');
  }
});

test('continues to an older verified run when the latest has no check', async t => {
  const {base, runs, jobRequests, github, find} = fixture(t);
  runs.unshift({...runs[0], id: 2, head_sha: base});
  const listJobs = github.rest.actions.listJobsForWorkflowRun;
  github.rest.actions.listJobsForWorkflowRun = async args =>
    args.run_id === 2 ? {data: {jobs: []}} : listJobs(args);
  assert.equal(await find(), base);
  assert.deepEqual(jobRequests, [1]);
});

test('API errors fall back to scanning', async t => {
  const {github, find} = fixture(t);
  github.rest.actions.listWorkflowRuns = async () => {
    throw new Error('API unavailable');
  };
  assert.equal(await find(), '');
});
