import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {test} from 'node:test';

import {baselineFiles, formatOutput, singleRuleConfig} from './oxlint-json-runner.ts';

const rule = '@sentry/scraps/prefer-primitives';
const diagnostic = {
  filename: 'static/a.tsx',
  code: '@sentry/scraps(prefer-primitives)',
  message: 'Use Flex',
  labels: [{span: {line: 17}}],
};

test('baseline selects rule files including tests and validates counts and paths', () => {
  assert.deepEqual(
    baselineFiles(
      {'static/a.spec.tsx': {[rule]: {count: 2}}, 'static/b.ts': {other: {count: 1}}},
      rule,
      '/repo'
    ),
    ['static/a.spec.tsx']
  );
  assert.deepEqual(baselineFiles({}, rule, '/repo'), []);
  for (const data of [
    null,
    [],
    {a: {[rule]: {count: -1}}},
    {a: {[rule]: {count: '1'}}},
  ]) {
    assert.throws(() => baselineFiles(data, rule, '/repo'));
  }
  for (const file of ['../a', '/a', 'static/../a', 'static//a', 'static\\a']) {
    assert.throws(() => baselineFiles({[file]: {[rule]: {count: 1}}}, rule, '/repo'));
  }
});

test('single-rule config preserves options, context, and explicit off overrides', () => {
  const config = singleRuleConfig(
    {
      plugins: ['typescript'],
      jsPlugins: ['a-plugin'],
      globals: {window: 'readonly'},
      settings: {react: {version: '19'}},
      options: {typeAware: false},
      categories: {style: 'error'},
      rules: {[rule]: ['warn', {option: true}], 'no-debugger': 'error'},
      overrides: [
        {files: ['**/*.spec.tsx'], rules: {[rule]: 'off', 'no-console': 'error'}},
      ],
    },
    rule
  );
  assert.deepEqual(config.rules, {[rule]: ['warn', {option: true}]});
  assert.deepEqual(config.overrides, [
    {files: ['**/*.spec.tsx'], rules: {[rule]: 'off'}},
  ]);
  assert.deepEqual(config.jsPlugins, ['a-plugin']);
  assert.deepEqual(config.globals, {window: 'readonly'});
  assert.equal(config.options?.typeAware, false);
  assert.equal(config.options?.reportUnusedDisableDirectives, 'off');
  assert(Object.values(config.categories ?? {}).every(value => value === 'off'));
  assert.deepEqual(singleRuleConfig(config, 'typescript/no-deprecated').rules, {
    'typescript/no-deprecated': 'error',
  });
});

test('formatter uses live lines and messages and rejects incomplete output', () => {
  assert.deepEqual(
    formatOutput({number_of_files: 1, diagnostics: [diagnostic]}, rule, '/repo', 1),
    [
      {
        filePath: '/repo/static/a.tsx',
        messages: [{line: 17, message: 'Use Flex', ruleId: rule}],
      },
    ]
  );
  for (const data of [
    {},
    {number_of_files: 0, diagnostics: []},
    {number_of_files: 1, diagnostics: [{...diagnostic, code: undefined}]},
    {number_of_files: 1, diagnostics: [{...diagnostic, labels: 'invalid'}]},
  ]) {
    assert.throws(() => formatOutput(data, rule, '/repo', 1));
  }
  assert.deepEqual(
    formatOutput({number_of_files: 1, diagnostics: []}, rule, '/repo', 1),
    []
  );
});

test('only the deprecated rule filters bare migration messages', () => {
  const diagnostics = ['`old` is deprecated.', '`old` is deprecated. Use new.'].map(
    message => ({...diagnostic, code: 'typescript(no-deprecated)', message})
  );
  const findings = formatOutput(
    {number_of_files: 1, diagnostics},
    'typescript/no-deprecated',
    '/repo',
    1
  );
  assert.equal(findings[0]?.messages.length, 1);
  assert.equal(findings[0]?.messages[0]?.message, '`old` is deprecated. Use new.');
});

test('native CLI reports suppressed test findings without mutating baseline and fails on bad source/config', () => {
  const repo = mkdtempSync(join(tmpdir(), 'oxlint-runner-test-'));
  const runner = resolve('.sentry-refactor-tasks/conventions/oxlint-json-runner.ts');
  const run = () =>
    spawnSync(process.execPath, [runner, repo, 'no-debugger', '--baseline'], {
      encoding: 'utf8',
      timeout: 30_000,
    });
  try {
    symlinkSync(resolve('node_modules'), join(repo, 'node_modules'));
    mkdirSync(join(repo, 'static'));
    writeFileSync(join(repo, 'package.json'), '{"type":"module"}');
    writeFileSync(
      join(repo, 'oxlint.config.ts'),
      'export default {rules: {"no-debugger": "error"}};'
    );
    writeFileSync(join(repo, 'static/a.spec.ts'), '\ndebugger;\n');
    const baseline = JSON.stringify({'static/a.spec.ts': {'no-debugger': {count: 1}}});
    writeFileSync(join(repo, 'oxlint-suppressions.json'), baseline);
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const findings = JSON.parse(result.stdout);
    assert.equal(findings[0]?.messages[0]?.line, 2);
    assert.equal(findings[0]?.messages[0]?.ruleId, 'no-debugger');
    assert.equal(readFileSync(join(repo, 'oxlint-suppressions.json'), 'utf8'), baseline);
    writeFileSync(join(repo, 'static/a.spec.ts'), 'const = ;');
    const failed = run();
    assert.notEqual(failed.status, 0);
    assert.equal(failed.stdout, '');
    assert.match(failed.stderr, /parse errors/);
    writeFileSync(
      join(repo, 'oxlint.config.ts'),
      'export default {plugins: ["does-not-exist"]};'
    );
    assert.notEqual(run().status, 0);
    assert(!readdirSync(repo).some(file => file.startsWith('refactor-oxlint-')));
    writeFileSync(join(repo, 'oxlint-suppressions.json'), '{}');
    assert.equal(run().stdout.trim(), '[]');
  } finally {
    rmSync(repo, {recursive: true, force: true});
  }
});
