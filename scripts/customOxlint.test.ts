import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {globSync} from 'tinyglobby';
import {parse} from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const runner = path.join(root, 'scripts/custom-oxlint.ts');

function fixture(t: {after: (cleanup: () => void) => void}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'oxlint-correctness-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const write = (file: string, contents: string) => {
    mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
    writeFileSync(path.join(directory, file), contents);
  };
  write('package.json', '{"private":true,"type":"module"}');
  write('.gitignore', 'node_modules/\n.artifacts/\n');
  write('oxlint-suppressions.json', '{}\n');
  mkdirSync(path.join(directory, 'node_modules'));
  symlinkSync(
    path.join(root, 'node_modules/oxlint'),
    path.join(directory, 'node_modules/oxlint')
  );
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', directory, ...args], {encoding: 'utf8'}).trim();
  const env = {...process.env, SENTRY_OXLINT_VERIFIED_BASE: ''};
  const lint = (...args: string[]) =>
    spawnSync(process.execPath, [runner, ...args], {
      cwd: directory,
      encoding: 'utf8',
      env,
    });
  const commit = () => {
    git('init', '--quiet');
    git('add', '.');
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '--quiet',
      '-m',
      'fixture'
    );
  };
  return {directory, write, git, lint, commit, env};
}

function ciFixture(t: {after: (cleanup: () => void) => void}) {
  const setup = fixture(t);
  const {directory, write, lint, commit, git, env} = setup;
  const log = path.join(directory, '.artifacts/scans');
  rmSync(path.join(directory, 'node_modules/oxlint'));
  write('node_modules/oxlint/package.json', '{"type":"module","exports":"./index.js"}');
  write('node_modules/oxlint/index.js', 'export {};');
  write(
    'node_modules/oxlint/cli.js',
    `
    import {appendFileSync} from 'node:fs';
    appendFileSync(${JSON.stringify(log)}, process.cwd() + '\\n');
    await import(${JSON.stringify(new URL('cli.js', import.meta.resolve('oxlint')).href)});
  `
  );
  write(
    'oxlint.config.ts',
    `
    export const incubator = {rules: {'no-debugger': 'error'}};
    export default {categories: {correctness: 'off'}, ...incubator};
  `
  );
  write('source.js', 'debugger;\n');
  write('pnpm-workspace.yaml', 'packages: []');
  write(
    'oxlint-suppressions.json',
    JSON.stringify({'source.js': {'no-debugger': {count: 1}}})
  );
  commit();
  const ci = (scans: number, verifiedBase = git('rev-parse', 'HEAD')) => {
    write('.artifacts/scans', '');
    env.SENTRY_OXLINT_VERIFIED_BASE = verifiedBase;
    const result = lint('--ci', '--base', 'HEAD');
    assert.equal(
      readFileSync(log, 'utf8').trim().split('\n').length,
      scans,
      result.stdout + result.stderr
    );
    return result;
  };
  return {...setup, ci};
}

test('lint-only paths do not count as frontend changes', t => {
  const {directory, write} = fixture(t);
  const lintOnly = [
    '.gitignore',
    '.node-version',
    'api-docs/package.json',
    'config/.oxlintignore',
    'oxlint-suppressions.json',
  ];
  for (const file of [...lintOnly, 'static/app/example.ts', 'package.json']) {
    write(file, '');
  }
  const filters = parse(
    readFileSync(path.join(root, '.github/file-filters.yml'), 'utf8')
  );
  const matches = (name: string) =>
    globSync(
      filters[name]
        .flat(Infinity)
        .flatMap((entry: Record<PropertyKey, unknown>) => Object.values(entry)),
      {
        cwd: directory,
        dot: true,
        expandDirectories: false,
        ignore: ['**/node_modules/**'],
      }
    );
  for (const file of lintOnly) {
    assert(matches('frontend_lint').includes(file), `${file} must trigger lint`);
    assert(!matches('frontend_all').includes(file), `${file} must not trigger frontend`);
  }
  assert(matches('frontend_all').includes('static/app/example.ts'));
  assert(matches('frontend_all').includes('package.json'));
});

test('override-only rules are enrolled with editor warnings and scoped CLI errors', t => {
  const {directory, write, lint} = fixture(t);
  const registry = `{
    rules: {},
    overrides: [
      {files: ['scoped/*.js'], rules: {'no-debugger': 'error'}},
      {files: ['scoped/excluded.js'], rules: {'no-debugger': 'off'}},
    ],
  }`;
  const config = readFileSync(path.join(root, 'oxlint.config.ts'), 'utf8').replace(
    'export const incubator = defineConfig({\n  rules: {},\n  overrides: [],\n});',
    `export const incubator = defineConfig(${registry});`
  );
  write('oxlint.config.ts', config);
  const inspect = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      const {default: config} = await import('./oxlint.config.ts');
      console.log(JSON.stringify(config.overrides.slice(-2).map(o => o.rules['no-debugger'])));
    `,
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {...process.env, SENTRY_OXLINT_ENFORCE: 'false'},
    }
  );
  assert.equal(inspect.status, 0, inspect.stderr);
  assert.deepEqual(JSON.parse(inspect.stdout), ['warn', 'off']);
  write(
    'oxlint.config.ts',
    `
    export const incubator = ${registry};
    export default {categories: {correctness: 'off'}, ...incubator};
  `
  );
  write('scoped/example.js', 'debugger;\n');
  write('scoped/excluded.js', 'debugger;\n');
  write('outside.js', 'debugger;\n');
  const snapshot = lint('--snapshot');
  assert.equal(snapshot.status, 0, snapshot.stderr);
  assert.deepEqual(JSON.parse(snapshot.stdout), {
    'scoped/example.js': {'no-debugger': {count: 1}},
  });
  write('oxlint-suppressions.json', snapshot.stdout);
  const ordinary = lint('scoped', 'outside.js');
  assert.equal(ordinary.status, 0, ordinary.stderr);
  const backlog = lint('--backlog', '--rule', 'no-debugger', '--json');
  assert.equal(backlog.status, 0, backlog.stderr);
  assert.equal(JSON.parse(backlog.stdout).findings.length, 1);
});

test('maintenance scans reject syntax errors instead of reporting clean debt', t => {
  const {write, lint} = fixture(t);
  write(
    'oxlint.config.ts',
    `export const incubator = {rules: {'no-debugger': 'error'}};
     export default {categories: {correctness: 'off'}, ...incubator};`
  );
  write('source.js', 'const = ;');
  const result = lint('--snapshot');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unclassified oxlint diagnostic/);
  assert.equal(result.stdout, '');
});

test('base scans resolve installed dependencies and use base workspace source', t => {
  const {directory, write, lint, commit} = fixture(t);
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
  write('packages/example/package.json', '{"name":"example","type":"module"}');
  write('packages/empty/package.json', '{"name":"empty","type":"module"}');
  write(
    'packages/provider/package.json',
    '{"name":"@fixture/provider","type":"module","types":"index.d.ts"}'
  );
  write('packages/provider/index.d.ts', 'export declare function run(): void;\n');
  for (const modules of ['node_modules', 'packages/example/node_modules']) {
    mkdirSync(path.join(directory, modules, '@fixture'), {recursive: true});
    symlinkSync(
      path.join(directory, 'packages/provider'),
      path.join(directory, modules, '@fixture/provider')
    );
  }
  write(
    'packages/example/node_modules/workspace-only/package.json',
    '{"name":"workspace-only","types":"index.d.ts"}'
  );
  write(
    'packages/example/node_modules/workspace-only/index.d.ts',
    'export declare function run(): Promise<void>;\n'
  );
  write(
    'packages/example/index.ts',
    "import {run} from 'workspace-only';\nimport {run as localRun} from '@fixture/provider';\nrun();\nlocalRun();\n"
  );
  write('index.ts', "import {run} from '@fixture/provider';\nrun();\n");
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {strict: true, target: 'ESNext', module: 'NodeNext'},
      include: ['index.ts', 'packages/**/*.ts'],
    })
  );
  write(
    'oxlint.config.ts',
    `
    export const incubator = {rules: {'typescript/no-floating-promises': 'error'}};
    export default {
      plugins: ['typescript'],
      categories: {correctness: 'off'},
      options: {typeAware: true},
      ...incubator,
    };
  `
  );
  commit();
  const result = lint('--enroll', '--base', 'HEAD');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(readFileSync(path.join(directory, 'oxlint-suppressions.json'), 'utf8')),
    {
      'packages/example/index.ts': {'typescript/no-floating-promises': {count: 1}},
    }
  );
  write(
    'packages/provider/index.d.ts',
    'export declare function run(): Promise<void>;\n'
  );
  const changed = lint('--check', '--base', 'HEAD');
  assert.equal(changed.status, 1, changed.stdout + changed.stderr);
  assert.match(
    changed.stderr,
    /packages\/example\/index.ts typescript\/no-floating-promises: 2 violations, budget 1/
  );
  assert.match(
    changed.stderr,
    /index.ts typescript\/no-floating-promises: 1 violations, budget 0/
  );
});

test('CI scans head once and rejects increased or stale budgets', t => {
  const {write, ci} = ciFixture(t);
  assert.equal(ci(1).status, 0);
  write('source.js', 'debugger; debugger;\n');
  write(
    'oxlint-suppressions.json',
    JSON.stringify({'source.js': {'no-debugger': {count: 2}}})
  );
  const increase = ci(1);
  assert.equal(increase.status, 1, increase.stderr);
  assert.match(increase.stderr, /2 violations, budget 1/);
  write('source.js', '');
  const stale = ci(1);
  assert.equal(stale.status, 1, stale.stderr);
  assert.match(stale.stderr, /Suppression budgets do not match live debt/);
  write('oxlint-suppressions.json', '{}');
  assert.equal(ci(1).status, 0);
});

test('CI transfers exact rename budgets but rejects copies and edited renames', t => {
  const {directory, write, git, ci} = ciFixture(t);
  renameSync(path.join(directory, 'source.js'), path.join(directory, 'moved.js'));
  git('add', 'source.js', 'moved.js');
  write(
    'oxlint-suppressions.json',
    JSON.stringify({'moved.js': {'no-debugger': {count: 1}}})
  );
  assert.equal(ci(1).status, 0);
  write('moved.js', 'debugger;\nvoid 0;\n');
  const edited = ci(1);
  assert.equal(edited.status, 1, edited.stderr);
  assert.match(edited.stderr, /moved.js no-debugger: 1 violations, budget 0/);
  write('source.js', 'debugger;\n');
  write('moved.js', 'debugger;\n');
  write(
    'oxlint-suppressions.json',
    JSON.stringify({
      'source.js': {'no-debugger': {count: 1}},
      'moved.js': {'no-debugger': {count: 1}},
    })
  );
  assert.equal(ci(1).status, 1);
});

test('CI rescans the base for changed policy or a missing baseline', t => {
  const {directory, write, ci, commit} = ciFixture(t);
  write('source.js', 'debugger; alert("existing");\n');
  commit();
  write(
    'oxlint.config.ts',
    `
    export const incubator = {rules: {'no-debugger': 'error', 'no-alert': 'error'}};
    export default {categories: {correctness: 'off'}, ...incubator};
  `
  );
  write(
    'oxlint-suppressions.json',
    JSON.stringify({
      'source.js': {'no-debugger': {count: 1}, 'no-alert': {count: 1}},
    })
  );
  assert.equal(ci(2).status, 0);
  write('source.js', 'debugger; alert("existing"); alert("new");\n');
  write(
    'oxlint-suppressions.json',
    JSON.stringify({
      'source.js': {'no-debugger': {count: 1}, 'no-alert': {count: 2}},
    })
  );
  const increase = ci(2);
  assert.equal(increase.status, 1, increase.stderr);
  assert.match(increase.stderr, /no-alert: 2 violations, budget 1/);
  rmSync(path.join(directory, 'oxlint-suppressions.json'));
  commit();
  write(
    'oxlint-suppressions.json',
    JSON.stringify({
      'source.js': {'no-debugger': {count: 1}, 'no-alert': {count: 2}},
    })
  );
  assert.equal(ci(2).status, 0);
});

test('CI detects changed policy inputs and deleted rules', t => {
  const {directory, write, ci} = ciFixture(t);
  for (const [file, contents] of [
    ['.node-version', '24.14.0'],
    ['pnpm-workspace.yaml', 'packages: [packages/*]'],
    ['pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .: {}\n"],
    ['nested/.gitignore', 'ignored.js'],
    ['nested/.eslintignore', 'ignored.js'],
    ['nested/.oxlintignore', 'ignored.js'],
    ['nested/package.json', '{"private":true}'],
    ['tsconfig.extra.json', '{}'],
    ['static/oxlint/example.ts', 'export {};'],
    ['scripts/custom-oxlint.ts', 'export {};'],
  ] as const) {
    write(file, contents);
    const result = ci(2);
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    rmSync(path.join(directory, file));
    if (file === 'pnpm-workspace.yaml') {
      write(file, 'packages: []');
    }
  }
  write(
    'oxlint.config.ts',
    `
    export const incubator = {rules: {}};
    export default {categories: {correctness: 'off'}, ...incubator};
  `
  );
  write('oxlint-suppressions.json', '{}');
  assert.equal(ci(2).status, 0);
});

test('CI rejects malformed base budgets rather than rescanning', t => {
  const {write, commit, ci} = ciFixture(t);
  write('oxlint-suppressions.json', '{"source.js":{"no-debugger":{"count":-1}}}');
  commit();
  write('oxlint-suppressions.json', '{"source.js":{"no-debugger":{"count":1}}}');
  const result = ci(1);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid suppression count/);
});

test('CI rescans unverified base commits instead of trusting stale budgets', t => {
  const {write, commit, ci} = ciFixture(t);
  write('oxlint-suppressions.json', '{"source.js":{"no-debugger":{"count":2}}}');
  commit();
  write('source.js', 'debugger; debugger;\n');
  for (const verifiedBase of ['', '0'.repeat(40)]) {
    const result = ci(2, verifiedBase);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /2 violations, budget 1/);
  }
});
