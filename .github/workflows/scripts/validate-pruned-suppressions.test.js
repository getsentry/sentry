import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const runner = fileURLToPath(
  new URL('./validate-pruned-suppressions.js', import.meta.url)
);

function fixture(
  t,
  files = ['oxlint-suppressions.json', 'packages/example/oxlint-suppressions.json']
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pruned-suppressions-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
    writeFileSync(path.join(directory, file), JSON.stringify(value));
  };
  const original = {'source.js': {'no-debugger': {count: 2}}};
  for (const file of files) write(file, original);
  execFileSync('git', ['init', '--quiet'], {cwd: directory});
  if (files.length > 0) execFileSync('git', ['add', ...files], {cwd: directory});
  const validate = artifact => {
    write('artifact/suppressions.json', artifact);
    return spawnSync(process.execPath, [runner, path.join(directory, 'artifact')], {
      cwd: directory,
      encoding: 'utf8',
    });
  };
  return {directory, original, validate};
}

test('pruned artifacts contain every project and can only reduce its own budgets', t => {
  const {directory, original, validate} = fixture(t);
  const artifact = {
    'oxlint-suppressions.json': {},
    'packages/example/oxlint-suppressions.json': original,
  };
  const rejected = (value, message) => {
    const result = validate(value);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
    for (const file of Object.keys(artifact)) {
      assert.deepEqual(
        JSON.parse(readFileSync(path.join(directory, file), 'utf8')),
        original
      );
    }
  };
  rejected([], /Artifact must be an object/);
  rejected({'oxlint-suppressions.json': {}}, /every committed suppression file/);
  rejected(
    {...artifact, 'extra/oxlint-suppressions.json': {}},
    /every committed suppression file/
  );
  for (const [budget, message] of [
    [null, /Suppressions must be an object/],
    [{'other.js': {'no-debugger': {count: 1}}}, /Unexpected file/],
    [{'source.js': {}}, /Invalid rules/],
    [{'source.js': {'no-alert': {count: 1}}}, /Unexpected rule/],
    [{'source.js': {'no-debugger': {count: 1, extra: true}}}, /Invalid budget/],
    [{'source.js': {'no-debugger': {count: 3}}}, /Invalid count/],
    [{'source.js': {'no-debugger': {count: 0}}}, /Invalid count/],
  ]) {
    rejected({...artifact, 'packages/example/oxlint-suppressions.json': budget}, message);
  }
  const reduced = validate({
    ...artifact,
    'packages/example/oxlint-suppressions.json': {
      'source.js': {'no-debugger': {count: 1}},
    },
  });
  assert.equal(reduced.status, 0, reduced.stderr);
  assert(!existsSync(path.join(directory, 'oxlint-suppressions.json')));
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        path.join(directory, 'packages/example/oxlint-suppressions.json'),
        'utf8'
      )
    ),
    {'source.js': {'no-debugger': {count: 1}}}
  );
});

test('pruned artifacts can remove every suppression file', t => {
  const {directory, validate} = fixture(t);
  const artifact = {
    'oxlint-suppressions.json': {},
    'packages/example/oxlint-suppressions.json': {},
  };
  const result = validate(artifact);
  assert.equal(result.status, 0, result.stderr);
  for (const file of Object.keys(artifact))
    assert(!existsSync(path.join(directory, file)));
});

test('pruned artifacts support repositories with no suppression files', t => {
  const {validate} = fixture(t, []);
  const result = validate({});
  assert.equal(result.status, 0, result.stderr);
  const extra = validate({'oxlint-suppressions.json': {}});
  assert.equal(extra.status, 1, extra.stderr);
  assert.match(extra.stderr, /every committed suppression file/);
});
