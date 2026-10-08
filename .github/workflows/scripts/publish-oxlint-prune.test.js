import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('./publish-oxlint-prune.sh', import.meta.url));
const branch = 'bot/prune-oxlint-suppressions';
const asset = 'oxlint-suppressions.json';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'oxlint-prune-pr-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const remote = path.join(directory, 'remote.git');
  const cwd = path.join(directory, 'checkout');
  const bin = path.join(directory, 'bin');
  const stateFile = path.join(directory, 'github.json');
  mkdirSync(cwd);
  mkdirSync(bin);
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '--bare', remote);
  git('init', '--initial-branch=master');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgSign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  git('remote', 'add', 'origin', remote);
  const write = (name, contents) => writeFileSync(path.join(cwd, name), contents);
  const budget = count => write(asset, `${JSON.stringify({count})}\n`);
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8'));
  const setState = value => writeFileSync(stateFile, JSON.stringify(value));
  setState({open: false, created: 0, closed: 0});
  writeFileSync(
    path.join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const state = JSON.parse(fs.readFileSync(process.env.GH_STATE, 'utf8'));
const [command, action] = process.argv.slice(2);
if (command !== 'pr') process.exit(2);
if (action === 'list') {
  if (state.failList) process.exit(1);
  if (state.open) console.log('1');
} else if (action === 'create') {
  state.open = true;
  state.created++;
} else if (action === 'close') {
  state.open = false;
  state.closed++;
} else process.exit(2);
fs.writeFileSync(process.env.GH_STATE, JSON.stringify(state));
`,
    {mode: 0o755}
  );
  budget(3);
  write('source.ts', 'export {};\n');
  git('add', '.');
  git('commit', '-m', 'initial');
  git('push', 'origin', 'master');
  const run = () =>
    execFileSync('bash', [script], {
      cwd,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        GH_STATE: stateFile,
        GITHUB_REPOSITORY: 'example/repository',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const head = () => git('--git-dir', remote, 'rev-parse', `refs/heads/${branch}`);
  const checkout = () => git('checkout', '-f', 'master');
  return {git, write, budget, state, setState, run, head, checkout, remote, bin};
}

test('reuses one suppression-only PR across updates, no-ops, closure, and merge', t => {
  const f = fixture(t);
  f.run();
  assert.equal(f.state().created, 0);

  f.budget(2);
  f.write('source.ts', 'unrelated staged change\n');
  f.git('add', 'source.ts');
  f.run();
  const first = f.head();
  assert.equal(f.state().created, 1);
  assert.equal(f.git('diff', '--name-only', 'master', first), asset);

  f.checkout();
  f.budget(2);
  f.run();
  assert.equal(f.head(), first);
  assert.equal(f.state().created, 1);

  f.checkout();
  f.write('source.ts', 'export const changed = true;\n');
  f.git('add', 'source.ts');
  f.git('commit', '-m', 'master advances');
  f.git('push', 'origin', 'master');
  f.budget(2);
  f.run();
  assert.equal(f.head(), first);
  f.checkout();
  f.budget(1);
  const scanned = f.git('rev-parse', 'HEAD');
  f.run();
  assert.equal(f.git('rev-parse', `${f.head()}^`), scanned);
  assert.equal(f.state().created, 1);

  f.setState({...f.state(), open: false});
  f.checkout();
  f.budget(1);
  f.run();
  assert.equal(f.state().created, 2);

  f.checkout();
  f.budget(0);
  f.git('add', asset);
  f.git('commit', '-m', 'remove remaining debt');
  f.git('push', 'origin', 'master');
  f.run();
  assert.equal(f.state().closed, 1);
  f.run();
  assert.equal(f.state().closed, 1);

  f.budget(2);
  f.git('add', asset);
  f.git('commit', '-m', 'new baseline');
  f.budget(1);
  f.run();
  f.checkout();
  f.git('merge', '--ff-only', branch);
  f.git('push', 'origin', 'master');
  f.setState({...f.state(), open: false});
  f.run();
  assert.equal(f.state().created, 3);
  f.budget(0);
  f.run();
  assert.equal(f.state().created, 4);
});

test('API errors and concurrent branch updates fail without overwriting the remote', t => {
  const f = fixture(t);
  f.budget(2);
  f.run();
  const first = f.head();
  f.checkout();
  f.budget(1);
  f.setState({...f.state(), failList: true});
  assert.throws(f.run);
  assert.equal(f.head(), first);
  f.setState({...f.state(), failList: false});

  const realGit = execFileSync('which', ['git'], {encoding: 'utf8'}).trim();
  const concurrent = f.git('rev-parse', 'master');
  writeFileSync(
    path.join(f.bin, 'git'),
    `#!/usr/bin/env node
const {spawnSync, execFileSync} = require('node:child_process');
const args = process.argv.slice(2);
const git = ${JSON.stringify(realGit)};
if (args[0] === 'push') {
  execFileSync(git, ['--git-dir', ${JSON.stringify(f.remote)}, 'update-ref', 'refs/heads/${branch}', '${concurrent}']);
}
const result = spawnSync(git, args, {stdio: 'inherit'});
process.exit(result.status ?? 1);
`,
    {mode: 0o755}
  );
  assert.throws(f.run);
  assert.equal(f.head(), concurrent);
  assert.equal(f.state().created, 1);
});
