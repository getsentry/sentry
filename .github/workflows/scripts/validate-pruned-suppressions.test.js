import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const runner = fileURLToPath(
  new URL('./validate-pruned-suppressions.js', import.meta.url)
);

test('pruned artifacts contain every project and can only reduce its own budgets', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pruned-suppressions-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
    writeFileSync(path.join(directory, file), JSON.stringify(value));
  };
  const original = {'source.js': {'no-debugger': {count: 2}}};
  for (const project of ['', 'packages/example/']) {
    write(project + 'oxlint-suppressions.json', original);
    write('artifact/' + project + 'oxlint-suppressions.json', original);
  }
  execFileSync('git', ['init', '--quiet'], {cwd: directory});
  execFileSync('git', ['add', 'oxlint-suppressions.json', 'packages'], {cwd: directory});
  const validate = () =>
    spawnSync(process.execPath, [runner, path.join(directory, 'artifact')], {
      cwd: directory,
      encoding: 'utf8',
    });
  write('artifact/oxlint-suppressions.json', {});
  write('artifact/packages/example/oxlint-suppressions.json', {
    'source.js': {'no-debugger': {count: 3}},
  });
  const increase = validate();
  assert.equal(increase.status, 1, increase.stderr);
  assert.match(increase.stderr, /Invalid count/);
  assert.deepEqual(
    JSON.parse(readFileSync(path.join(directory, 'oxlint-suppressions.json'), 'utf8')),
    original
  );
  rmSync(path.join(directory, 'artifact/packages/example/oxlint-suppressions.json'));
  assert.equal(validate().status, 1);
  write('artifact/packages/example/oxlint-suppressions.json', original);
  write('artifact/extra/oxlint-suppressions.json', {});
  assert.equal(validate().status, 1);
  rmSync(path.join(directory, 'artifact/extra'), {recursive: true});
  write('artifact/packages/example/oxlint-suppressions.json', {'source.js': {}});
  const emptyRules = validate();
  assert.equal(emptyRules.status, 1, emptyRules.stderr);
  assert.match(emptyRules.stderr, /Invalid rules/);
  write('artifact/packages/example/oxlint-suppressions.json', {
    'source.js': {'no-debugger': {count: 1}},
  });
  const reduced = validate();
  assert.equal(reduced.status, 0, reduced.stderr);
  assert.deepEqual(
    JSON.parse(readFileSync(path.join(directory, 'oxlint-suppressions.json'), 'utf8')),
    {}
  );
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
