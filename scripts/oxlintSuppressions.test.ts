import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {
  chmodSync,
  existsSync,
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
import {fileURLToPath, pathToFileURL} from 'node:url';

import {resolve} from 'eslint-import-resolver-typescript';
import {globSync} from 'tinyglobby';
import {parse} from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const runner = path.join(root, 'scripts/oxlint-suppressions.ts');

test('root lint excludes workspaces that own their lint tasks', () => {
  const app = 'static/app/components/inspector.tsx';
  const icons = 'static/packages/icons/src/iconAdd.tsx';
  const scraps = 'static/packages/scraps/src/layout/index.tsx';
  const result = spawnSync(
    process.execPath,
    [runner, '--debug', 'files', app, icons, scraps],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert(result.stdout.includes(app), result.stdout);
  assert(!result.stdout.includes(icons), result.stdout);
  assert(!result.stdout.includes(scraps), result.stdout);
});

test('boundary resolver resolves app aliases with workspace project references', async () => {
  const {default: lintConfig} = await import(
    new URL('../oxlint.config.ts', import.meta.url).href
  );
  const importer = path.join(root, 'static/app/components/inspector.tsx');
  const options = lintConfig.settings['import/resolver'].typescript;

  for (const [specifier, target] of [
    ['@sentry/scraps/overlay', 'static/packages/scraps/src/overlay.tsx'],
    ['sentry/stories/storybook', 'static/app/stories/storybook.tsx'],
    ['@sentry/icons/add', 'static/packages/icons/src/iconAdd.tsx'],
  ] as const) {
    assert.deepEqual(resolve(specifier, importer, options), {
      found: true,
      path: path.join(root, target),
    });
  }
});

test('domain badges are app dependencies and stay outside the scraps boundary', t => {
  const directories = ['static/app', 'static/packages/scraps/src'].map(directory =>
    mkdtempSync(path.join(root, directory, 'boundary-probe-'))
  );
  t.after(() =>
    directories.forEach(directory => rmSync(directory, {recursive: true, force: true}))
  );
  const files = directories.map(directory => {
    const file = path.join(directory, 'probe.ts');
    writeFileSync(
      file,
      "import {DeployBadge} from 'sentry/components/core/badge/deployBadge';\nexport const badge = DeployBadge;\n"
    );
    return file;
  });
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('cli.js', import.meta.resolve('oxlint'))),
      '--format',
      'json',
      ...files,
    ],
    {cwd: root, encoding: 'utf8'}
  );
  const diagnostics = JSON.parse(result.stdout).diagnostics.filter(
    (item: {filename: string}) => item.filename
  );
  assert(
    diagnostics.every(
      (item: {filename: string}) => path.resolve(root, item.filename) === files[1]
    )
  );
  const diagnostic = diagnostics.find(
    (item: {code: string}) => item.code === 'import-js(no-extraneous-dependencies)'
  );
  assert(diagnostic);
  assert.match(diagnostic.message, /@sentry-internal\/app/);
});

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
  const env = {...process.env, GITHUB_OUTPUT: '', SENTRY_OXLINT_VERIFIED_BASE: ''};
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

test('CI runs full lint when a package config changes', t => {
  const {directory, write} = fixture(t);
  write('.github/workflows/scripts/git-merge-base.sh', "#!/bin/sh\nprintf 'base\\n'\n");
  write('bin/git', '#!/bin/sh\nprintf \'%s\\n\' "$SENTRY_TEST_CHANGED_FILES"\n');
  chmodSync(path.join(directory, '.github/workflows/scripts/git-merge-base.sh'), 0o755);
  chmodSync(path.join(directory, 'bin/git'), 0o755);
  for (const [file, scope] of [
    ['static/packages/icons/src/iconAdd.tsx', 'scoped'],
    ['oxlint-suppressions.json', 'scoped'],
    ['oxlint.base.ts', 'full'],
    ['static/packages/icons/oxlint.config.ts', 'full'],
    ['static/packages/scraps/oxlint.config.ts', 'full'],
    ['static/packages/scraps/.oxlintrc.json', 'full'],
  ] as const) {
    const result = spawnSync(
      'bash',
      [path.join(root, '.github/workflows/scripts/frontend-changed-scope.sh')],
      {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: path.join(directory, 'bin') + ':' + process.env.PATH,
          SENTRY_TEST_CHANGED_FILES: file,
        },
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp('scope=' + scope), file);
  }
});

test('package lint enforces shared rules and local test boundaries', t => {
  const {directory, write} = fixture(t);
  rmSync(path.join(directory, 'node_modules'), {recursive: true});
  symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'));
  rmSync(path.join(directory, 'oxlint-suppressions.json'));
  write(
    'package.json',
    JSON.stringify({
      private: true,
      type: 'module',
      devDependencies: {
        '@sentry-internal/monorepo': 'workspace:*',
        '@testing-library/react': '16.3.2',
      },
    })
  );
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler'},
      include: ['src', 'test'],
    })
  );
  const shared = pathToFileURL(path.join(root, 'oxlint.base.ts')).href;
  write(
    'oxlint.config.ts',
    `
    import {createPackageConfig} from ${JSON.stringify(shared)};
    export default createPackageConfig(import.meta.dirname);
  `
  );
  write(
    'src/invalid.ts',
    'export const equal = (left: number, right: number) => left == right;'
  );
  write('src/typeAware.ts', 'export async function getValue() { return await 42; }');
  write(
    'src/consumer.ts',
    "import {answer} from '../test/helper'; export const value = answer;"
  );
  write('test/helper.ts', 'export const answer = 42;');
  write(
    'src/appImport.ts',
    "import {value} from 'sentry/syntheticModule'; export const answer = value;"
  );
  write(
    'src/valid.spec.tsx',
    "import {render} from '@testing-library/react'; test('renders', () => {render(<div />);});"
  );
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('cli.js', import.meta.resolve('oxlint'))),
      '--type-aware',
      '--format',
      'json',
      '.',
    ],
    {cwd: directory, encoding: 'utf8'}
  );
  assert.equal(result.status, 1, result.stderr);
  const {diagnostics} = JSON.parse(result.stdout) as {
    diagnostics: Array<{code: string; filename: string}>;
  };
  const codes = diagnostics.map(({code}) => code);
  for (const expected of [
    'eslint(eqeqeq)',
    'typescript(await-thenable)',
    'boundaries(dependencies)',
    'eslint(no-restricted-imports)',
  ]) {
    assert(codes.includes(expected), JSON.stringify(diagnostics));
  }
  assert(
    !diagnostics.some(({filename}) => filename.endsWith('/src/valid.spec.tsx')),
    JSON.stringify(diagnostics)
  );
});

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
    'static/app/oxlint-suppressions.json',
    'tests/js/oxlint-suppressions.json',
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

// Workflow script tests run without installed dependencies, so the YAML contract lives here.
test('verified lint bases require the exact budgets step after the ratchet', () => {
  const step = 'Verify exact lint budgets';
  const {jobs} = parse(
    readFileSync(path.join(root, '.github/workflows/frontend.yml'), 'utf8')
  );
  const steps: Array<{id?: string; if?: string; name?: string; run?: string}> =
    jobs.oxlint.steps;
  const ratchet = steps.findIndex(({name}) => name === 'Verify lint ratchet');
  const exact = steps.findIndex(({name}) => name === step);
  assert(ratchet >= 0 && exact > ratchet);
  assert.equal(steps[ratchet]!.id, 'ratchet');
  assert.match(steps[ratchet]!.run ?? '', /pnpm run lint:suppressions --ci/);
  assert.equal(steps[exact]!.if, "steps.ratchet.outputs.budgets == 'exact'");
  assert(
    readFileSync(
      path.join(root, '.github/workflows/scripts/find-verified-lint-base.js'),
      'utf8'
    ).includes(`EXACT_BUDGETS_STEP = '${step}'`)
  );
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
    /^export const incubator = defineConfig\(\{[\s\S]+?^\}\);/m,
    `export const incubator = defineConfig(${registry});`
  );
  write('oxlint.config.ts', config);
  write('oxlint.base.ts', readFileSync(path.join(root, 'oxlint.base.ts'), 'utf8'));
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
    JSON.parse(
      readFileSync(
        path.join(directory, 'packages/example/oxlint-suppressions.json'),
        'utf8'
      )
    ),
    {
      'index.ts': {'typescript/no-floating-promises': {count: 1}},
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
  assert.match(
    changed.stderr,
    /packages\/example\/index.ts:4:1 typescript\/no-floating-promises Promises must be awaited/
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
  assert.match(
    increase.stderr,
    /source.js:1:1 no-debugger `debugger` statement is not allowed/
  );
  assert.match(
    increase.stderr,
    /source.js:1:11 no-debugger `debugger` statement is not allowed/
  );
  write('source.js', '');
  const stale = ci(1);
  assert.equal(stale.status, 1, stale.stderr);
  assert.match(stale.stderr, /Suppression budgets are stale/);
  assert.match(stale.stderr, /pnpm run lint:suppressions --prune/);
  assert.match(stale.stderr, /commit the updated oxlint-suppressions.json/);
  assert.match(stale.stderr, /source.js no-debugger: budget 2, 0 violations/);
  assert.doesNotMatch(stale.stderr, /fix:oxlint|--enroll|New incubator violations/);
  write('oxlint-suppressions.json', '{}');
  assert.equal(ci(1).status, 0);
});

test('CI only warns about stale budgets inherited from the base', t => {
  const {directory, write, commit, lint, ci, env} = ciFixture(t);
  const output = '.artifacts/github-output';
  const budgets = () => readFileSync(path.join(directory, output), 'utf8').trim();
  env.GITHUB_OUTPUT = path.join(directory, output);
  write('source.js', '');
  commit();
  write(output, '');
  const master = lint('--ci');
  assert.equal(master.status, 0, master.stderr);
  assert.match(master.stderr, /Ignoring stale suppression budgets/);
  assert.match(master.stderr, /source.js no-debugger: budget 1, 0 violations/);
  assert.match(master.stdout, /Incubator ratchet passed/);
  assert.equal(budgets(), 'budgets=stale');
  // A stale base cannot be verified, so each PR check scans the base.
  write('source.js', 'void 0;\n');
  write(output, '');
  const unrelated = ci(2, '');
  assert.equal(unrelated.status, 0, unrelated.stderr);
  assert.match(unrelated.stderr, /source.js no-debugger: budget 1, 0 violations/);
  assert.equal(budgets(), 'budgets=stale');
  write('source.js', 'debugger;\n');
  const refill = ci(2, '');
  assert.equal(refill.status, 1, refill.stderr);
  assert.match(refill.stderr, /source.js no-debugger: 1 violations, budget 0/);
  write('source.js', '');
  write(
    'oxlint-suppressions.json',
    JSON.stringify({'source.js': {'no-debugger': {count: 2}}})
  );
  const edited = ci(2, '');
  assert.equal(edited.status, 1, edited.stderr);
  assert.match(edited.stderr, /Suppression budgets are stale/);
  assert.match(edited.stderr, /source.js no-debugger: budget 2, 0 violations/);
  write('oxlint-suppressions.json', '{}');
  write(output, '');
  const pruned = ci(2, '');
  assert.equal(pruned.status, 0, pruned.stderr);
  assert.doesNotMatch(pruned.stderr, /stale/);
  assert.equal(budgets(), 'budgets=exact');
});

test('CI requires pruning debt reduced indirectly by another file', t => {
  const {write, lint, commit, env} = fixture(t);
  write('pnpm-workspace.yaml', 'packages: []');
  write('types.d.ts', 'declare function run(): Promise<void>;\n');
  write('index.ts', 'run();\n');
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {strict: true, target: 'ESNext', module: 'NodeNext'},
      include: ['*.ts'],
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
  write(
    'oxlint-suppressions.json',
    JSON.stringify({'index.ts': {'typescript/no-floating-promises': {count: 1}}})
  );
  commit();
  env.SENTRY_OXLINT_VERIFIED_BASE = '';
  assert.equal(lint('--ci', '--base', 'HEAD').status, 0);
  write('types.d.ts', 'declare function run(): void;\n');
  const reduced = lint('--ci', '--base', 'HEAD');
  assert.equal(reduced.status, 1, reduced.stdout + reduced.stderr);
  assert.match(reduced.stderr, /Suppression budgets are stale/);
  assert.match(
    reduced.stderr,
    /index.ts typescript\/no-floating-promises: budget 1, 0 violations/
  );
});

test('CI and prune report violations exceeding committed budgets', t => {
  const {directory, write, lint, ci} = ciFixture(t);
  write('oxlint-suppressions.json', '{}');
  for (const result of [ci(1), lint('--ci'), lint('--prune')]) {
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /source.js no-debugger: 1 violations, budget 0/);
    assert.match(
      result.stderr,
      /source.js:1:1 no-debugger `debugger` statement is not allowed/
    );
    assert.doesNotMatch(result.stderr, /stale|pnpm run lint:suppressions --prune/);
  }
  assert.equal(
    readFileSync(path.join(directory, 'oxlint-suppressions.json'), 'utf8'),
    '{}'
  );
});

test('missing suppression files are empty budgets and maintenance leaves them absent', t => {
  const {directory, write, lint, commit} = fixture(t);
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
  write('packages/example/package.json', '{"name":"example","type":"module"}');
  write('packages/example/source.js', '');
  write(
    'oxlint.config.ts',
    `export const incubator = {rules: {'no-debugger': 'error'}}; export default {categories: {correctness: 'off'}, ...incubator};`
  );
  rmSync(path.join(directory, 'oxlint-suppressions.json'));
  commit();
  const assets = [
    'oxlint-suppressions.json',
    'packages/example/oxlint-suppressions.json',
  ];
  for (const args of [
    [],
    ['--fix'],
    ['--ci'],
    ['--prune'],
    ['--enroll', '--base', 'HEAD'],
  ]) {
    const result = lint(...args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const asset of assets) {
      assert(!existsSync(path.join(directory, asset)), asset);
    }
  }
  write('packages/example/source.js', 'debugger;\n');
  for (const args of [[], ['--fix'], ['--ci'], ['--prune']]) {
    const result = lint(...args);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /no-debugger/);
    for (const asset of assets) {
      assert(!existsSync(path.join(directory, asset)), asset);
    }
  }
});

test('CI reuses verified empty budgets when all suppression files are absent', t => {
  const {directory, write, commit, ci} = ciFixture(t);
  write('source.js', '');
  rmSync(path.join(directory, 'oxlint-suppressions.json'));
  commit();
  const clean = ci(1);
  assert.equal(clean.status, 0, clean.stderr);
  write('source.js', 'debugger;\n');
  const increase = ci(1);
  assert.equal(increase.status, 1, increase.stderr);
  assert.match(increase.stderr, /source.js no-debugger: 1 violations, budget 0/);
  assert(!existsSync(path.join(directory, 'oxlint-suppressions.json')));
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
  assert.match(
    increase.stderr,
    /source.js:1:11 no-alert `alert`, `confirm` and `prompt` functions are not allowed/
  );
  assert.match(
    increase.stderr,
    /source.js:1:30 no-alert `alert`, `confirm` and `prompt` functions are not allowed/
  );
  assert.doesNotMatch(increase.stderr, /no-debugger/);
  rmSync(path.join(directory, 'oxlint-suppressions.json'));
  commit();
  write(
    'oxlint-suppressions.json',
    JSON.stringify({
      'source.js': {'no-debugger': {count: 1}, 'no-alert': {count: 2}},
    })
  );
  assert.equal(ci(2, '').status, 0);
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
    ['scripts/oxlint-suppressions.ts', 'export {};'],
    ['oxlint.base.ts', 'export {};'],
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

test('workspace assets round-trip native lint, prune, historical budgets, and cross-project renames', t => {
  const {directory, write, lint, commit, git, env} = fixture(t);
  write(
    'pnpm-workspace.yaml',
    "packages:\n  - 'packages/*'\n  - 'packages/outer/nested'\n"
  );
  for (const project of ['a', 'b', 'outer', 'outer/nested']) {
    write(
      `packages/${project}/package.json`,
      JSON.stringify({name: project.replace('/', '-'), type: 'module'})
    );
  }
  write(
    'oxlint.config.ts',
    `export const incubator = {rules: {'no-debugger': 'error'}}; export default {categories: {correctness: 'off'}, ...incubator};`
  );
  write('packages/a/source.js', 'debugger;\n');
  write('packages/outer/nested/source.js', 'debugger;\n');
  write(
    'oxlint-suppressions.json',
    JSON.stringify({
      'packages/a/source.js': {'no-debugger': {count: 1}},
      'packages/outer/nested/source.js': {'no-debugger': {count: 1}},
    })
  );
  commit();
  const originalBase = git('rev-parse', 'HEAD');
  const enroll = lint('--enroll', '--base', originalBase);
  assert.equal(enroll.status, 0, enroll.stderr);
  const read = (project: string) =>
    JSON.parse(
      readFileSync(path.join(directory, project, 'oxlint-suppressions.json'), 'utf8')
    );
  assert(!existsSync(path.join(directory, 'oxlint-suppressions.json')));
  assert.deepEqual(read('packages/a'), {'source.js': {'no-debugger': {count: 1}}});
  assert(!existsSync(path.join(directory, 'packages/outer/oxlint-suppressions.json')));
  assert.deepEqual(read('packages/outer/nested'), {
    'source.js': {'no-debugger': {count: 1}},
  });
  const bytes = readFileSync(
    path.join(directory, 'packages/a/oxlint-suppressions.json'),
    'utf8'
  );
  const ordinary = lint('packages');
  assert.equal(ordinary.status, 0, ordinary.stderr);
  assert.equal(
    readFileSync(path.join(directory, 'packages/a/oxlint-suppressions.json'), 'utf8'),
    bytes
  );
  env.SENTRY_OXLINT_VERIFIED_BASE = originalBase;
  const oldBase = lint('--ci', '--base', originalBase);
  assert.equal(oldBase.status, 0, oldBase.stderr);
  commit();
  renameSync(
    path.join(directory, 'packages/a/source.js'),
    path.join(directory, 'packages/b/source.js')
  );
  git('add', 'packages/a/source.js', 'packages/b/source.js');
  const renamed = lint('--enroll', '--base', 'HEAD');
  assert.equal(renamed.status, 0, renamed.stderr);
  assert(!existsSync(path.join(directory, 'packages/a/oxlint-suppressions.json')));
  assert.deepEqual(read('packages/b'), {'source.js': {'no-debugger': {count: 1}}});
  write('packages/b/source.js', '');
  const fix = lint('--fix', 'packages/b');
  assert.equal(fix.status, 0, fix.stderr);
  assert(!existsSync(path.join(directory, 'packages/b/oxlint-suppressions.json')));
  assert.deepEqual(read('packages/outer/nested'), {
    'source.js': {'no-debugger': {count: 1}},
  });
  write('packages/outer/nested/source.js', '');
  const prune = lint('--prune');
  assert.equal(prune.status, 0, prune.stderr);
  assert(
    !existsSync(path.join(directory, 'packages/outer/nested/oxlint-suppressions.json'))
  );
});

test('maintenance scans isolated package policy using HEAD policy against base source', t => {
  const {directory, write, lint, commit, git} = fixture(t);
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
  write('packages/example/package.json', '{"name":"example","type":"module"}');
  write('packages/example/source.js', 'debugger;\n');
  write('packages/example/disabled.js', 'debugger;\n');
  write(
    'oxlint.config.ts',
    `export const incubator = {rules: {'no-debugger': 'error'}}; export default {categories: {correctness: 'off'}, ...incubator};`
  );
  commit();
  const base = git('rev-parse', 'HEAD');
  write(
    'oxlint.config.ts',
    `export const incubator = {rules: {'no-debugger': 'error'}}; export default {ignorePatterns: ['packages/**'], categories: {correctness: 'off'}, ...incubator};`
  );
  write(
    'packages/example/oxlint.config.ts',
    `export default {rules: {'no-debugger': 'warn'}, overrides: [{files: ['disabled.js'], rules: {'no-debugger': 'off'}}]};`
  );
  const enroll = lint('--enroll', '--base', base);
  assert.equal(enroll.status, 0, enroll.stderr);
  const asset = path.join(directory, 'packages/example/oxlint-suppressions.json');
  assert.deepEqual(JSON.parse(readFileSync(asset, 'utf8')), {
    'source.js': {'no-debugger': {count: 1}},
  });
  const prune = lint('--prune');
  assert.equal(prune.status, 0, prune.stderr);
  assert.deepEqual(JSON.parse(readFileSync(asset, 'utf8')), {
    'source.js': {'no-debugger': {count: 1}},
  });
  const ordinary = lint('--fix');
  assert.equal(ordinary.status, 0, ordinary.stdout + ordinary.stderr);
  assert.deepEqual(JSON.parse(readFileSync(asset, 'utf8')), {
    'source.js': {'no-debugger': {count: 1}},
  });
  const native = spawnSync(
    process.execPath,
    [new URL('cli.js', import.meta.resolve('oxlint')).pathname, '-D', 'no-debugger', '.'],
    {cwd: path.join(directory, 'packages/example'), encoding: 'utf8'}
  );
  assert.equal(native.status, 0, native.stdout + native.stderr);
  assert.doesNotMatch(native.stdout, /Unexpected debugger/);
  write('packages/example/source.js', 'debugger; debugger;\n');
  const check = lint('--check', '--base', base);
  assert.equal(check.status, 1, check.stdout + check.stderr);
  assert.match(
    check.stderr,
    /packages\/example\/source.js no-debugger: 2 violations, budget 1/
  );
});

test('abandoned transactions restore all project assets and reject corrupt journals', t => {
  const {directory, write, lint, commit} = fixture(t);
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
  write('packages/example/package.json', '{"name":"example","type":"module"}');
  write(
    'oxlint.config.ts',
    `export const incubator = {rules: {'no-debugger': 'error'}}; export default {categories: {correctness: 'off'}, ...incubator};`
  );
  write('packages/example/source.js', 'debugger;\n');
  commit();
  const child = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], {
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const original = '{"source.js":{"no-debugger":{"count":1}}}\n';
  const policy = 'packages/example/.oxlint-incubator-abcd.json';
  const lease = {
    pid: Number(child.stdout.trim()),
    token: 'abcd',
    assets: {
      'oxlint-suppressions.json': Buffer.from('{}\n').toString('base64'),
      'packages/example/oxlint-suppressions.json':
        Buffer.from(original).toString('base64'),
    },
    policies: [policy],
  };
  write('.artifacts/lint-incubator/transactions/owner.json', JSON.stringify(lease));
  write(policy, '{}');
  write('oxlint-suppressions.json', 'corrupt temporary native file');
  const recovered = lint('--backlog', '--json');
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(
    readFileSync(
      path.join(directory, 'packages/example/oxlint-suppressions.json'),
      'utf8'
    ),
    original
  );
  assert.equal(
    readFileSync(path.join(directory, 'oxlint-suppressions.json'), 'utf8'),
    '{}\n'
  );
  assert.throws(() => readFileSync(path.join(directory, policy)), /ENOENT/);
  write(
    '.artifacts/lint-incubator/transactions/owner.json',
    JSON.stringify({...lease, assets: {'../oxlint-suppressions.json': null}})
  );
  const corrupt = lint('--snapshot');
  assert.equal(corrupt.status, 2, corrupt.stderr);
  assert.match(corrupt.stderr, /Invalid suppression asset path/);
  assert.equal(
    readFileSync(
      path.join(directory, 'packages/example/oxlint-suppressions.json'),
      'utf8'
    ),
    original
  );
});
