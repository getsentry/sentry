import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
  const lint = (...args: string[]) =>
    spawnSync(process.execPath, [runner, ...args], {
      cwd: directory,
      encoding: 'utf8',
    });
  return {directory, write, git, lint};
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

test('base scans resolve installed dependencies and use base workspace source', t => {
  const {directory, write, git, lint} = fixture(t);
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
