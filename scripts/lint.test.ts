import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  chmodSync,
  existsSync,
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

const root = fileURLToPath(new URL('../', import.meta.url));
const runner = path.join(root, 'scripts/lint.ts');

function fixture(t: {after: (cleanup: () => void) => void}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'workspace-lint-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const write = (file: string, contents: string) => {
    mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
    writeFileSync(path.join(directory, file), contents);
  };
  write(
    'pnpm-workspace.yaml',
    'packages: [packages/*]\nincludeWorkspaceRoot: true\nverifyDepsBeforeRun: false\n'
  );
  write(
    'record.mjs',
    `#!/usr/bin/env node
    import {appendFileSync, readFileSync} from 'node:fs';
    const {name} = JSON.parse(readFileSync('package.json', 'utf8'));
    appendFileSync(${JSON.stringify(path.join(directory, 'runs.jsonl'))},
      JSON.stringify({name, args: process.argv.slice(2)}) + '\\n');
    process.exitCode = process.env.FAIL_WORKSPACE === name ? 1 : 0;`
  );
  chmodSync(path.join(directory, 'record.mjs'), 0o755);
  mkdirSync(path.join(directory, 'bin'));
  symlinkSync(path.join(directory, 'record.mjs'), path.join(directory, 'bin/stylelint'));
  write(
    'package.json',
    JSON.stringify({
      name: 'root',
      private: true,
      scripts: {
        'lint:js:root': 'node record.mjs',
        'lint:css:root': 'node record.mjs',
      },
    })
  );
  for (const name of ['icons', 'scraps', 'unmigrated']) {
    write(
      `packages/${name}/package.json`,
      JSON.stringify({
        name,
        scripts:
          name === 'unmigrated'
            ? {}
            : {
                'lint:js': 'node ../../record.mjs',
                'lint:css': 'node ../../record.mjs',
              },
      })
    );
  }
  return {
    directory,
    write,
    lint: (language: string, args: string[] = [], failWorkspace = '') => {
      const result = spawnSync(process.execPath, [runner, language, ...args], {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          FAIL_WORKSPACE: failWorkspace,
          PATH: path.join(directory, 'bin') + path.delimiter + process.env.PATH,
        },
      });
      const log = path.join(directory, 'runs.jsonl');
      const runs = (existsSync(log) ? readFileSync(log, 'utf8') : '')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as {args: string[]; name: string});
      return {...result, runs};
    },
  };
}

test('full JS lint invokes every package with a task from its own directory', t => {
  const {lint} = fixture(t);
  const result = lint('js', ['--quiet', '--fix']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.runs[0], {
    name: 'root',
    args: ['--no-error-on-unmatched-pattern', '--quiet', '--fix'],
  });
  assert.deepEqual(
    result.runs.slice(1).sort((a, b) => a.name.localeCompare(b.name)),
    [
      {name: 'icons', args: ['--quiet', '--fix']},
      {name: 'scraps', args: ['--quiet', '--fix']},
    ]
  );
});

test('native option values reach package tasks without root file paths', t => {
  const {lint} = fixture(t);
  const result = lint('js', [
    '--format',
    'json',
    '--threads=1',
    '-D',
    'no-var',
    'packages/icons/src/example.tsx',
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.runs.length, 1);
  for (const run of result.runs) {
    assert.deepEqual(run.args, [
      '--no-error-on-unmatched-pattern',
      '--format',
      'json',
      '--threads=1',
      '-D',
      'no-var',
      'src/example.tsx',
    ]);
  }
});

test('CSS lint defaults to a full root scan and invokes package tasks', t => {
  const {lint} = fixture(t);
  const result = lint('css', ['--formatter', 'compact']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.runs[0]!.args, ['--formatter', 'compact', '**/*.[jt]sx']);
  assert.equal(result.runs.length, 3);
});

test('scoped JS lint keeps application and unmigrated workspace files in the root', t => {
  const {lint} = fixture(t);
  const result = lint('js', [
    '--fix',
    'static/app/example.tsx',
    'packages/unmigrated/example.ts',
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.runs, [
    {
      name: 'root',
      args: [
        '--no-error-on-unmatched-pattern',
        '--fix',
        'static/app/example.tsx',
        'packages/unmigrated/example.ts',
      ],
    },
  ]);
});

test('scoped CSS lint routes files to their owning projects', t => {
  const {lint} = fixture(t);
  const result = lint('css', [
    '--quiet',
    'static/app/example.tsx',
    'packages/icons/src/example.tsx',
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.runs, [
    {name: 'root', args: ['--quiet', 'static/app/example.tsx']},
    {name: 'icons', args: ['--allow-empty-input', '--quiet', 'src/example.tsx']},
  ]);
});

test('suppression maintenance uses a separate root command', t => {
  for (const flag of [
    '--check',
    '--ci',
    '--enroll',
    '--prune',
    '--backlog',
    '--snapshot',
  ]) {
    const {lint} = fixture(t);
    const result = lint('js', [flag]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /pnpm run lint:suppressions/);
    assert.deepEqual(result.runs, []);
  }
});

test('config inspection does not invoke package tasks', t => {
  for (const args of [['--print-config'], ['--help'], ['--version'], ['--rules']]) {
    const {lint} = fixture(t);
    const result = lint('js', args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(result.runs, [{name: 'root', args}]);
  }
});

test('package failures fail the root command while other packages still run', t => {
  const {lint} = fixture(t);
  const result = lint('js', [], 'icons');
  assert.notEqual(result.status, 0);
  assert.equal(result.runs.length, 3, result.stdout + result.stderr);
});

test('root failures stop before package tasks run', t => {
  const {lint} = fixture(t);
  const result = lint('js', ['--fix'], 'root');
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.runs, [
    {name: 'root', args: ['--no-error-on-unmatched-pattern', '--fix']},
  ]);
});

for (const [language, options] of [
  ['js', []],
  ['js', ['--quiet', '--no-error-on-unmatched-pattern']],
  ['css', []],
] as const) {
  test(`scoped ${language} fixes with ${JSON.stringify(options)} leave unselected files unchanged; package defaults scan all files`, t => {
    const {directory, write, lint} = fixture(t);
    const extension = language === 'js' ? 'js' : 'tsx';
    const original =
      language === 'js'
        ? 'var value = 1; console.log(value);\n'
        : 'a { color: #ffffff; }\n';
    const fixed =
      language === 'js'
        ? 'const value = 1; console.log(value);\n'
        : 'a { color: #fff; }\n';
    for (const name of ['icons', 'scraps']) {
      const manifest = JSON.parse(
        readFileSync(path.join(root, 'static/packages', name, 'package.json'), 'utf8')
      );
      write(
        `packages/${name}/package.json`,
        JSON.stringify({
          name,
          scripts: {
            [`lint:${language}`]: manifest.scripts[`lint:${language}`].replace(
              '--type-aware ',
              ''
            ),
          },
        })
      );
      write(
        `packages/${name}/.oxlintrc.json`,
        JSON.stringify({ignorePatterns: ['ignored.js'], rules: {'no-var': 'error'}})
      );
      write(
        `packages/${name}/.stylelintrc.json`,
        JSON.stringify({rules: {'color-hex-length': 'short'}})
      );
      write(`packages/${name}/selected.${extension}`, original);
      write(`packages/${name}/unselected.${extension}`, original);
      if (language === 'js') {
        write(`packages/${name}/ignored.js`, original);
      }
    }
    mkdirSync(path.join(directory, 'node_modules'));
    symlinkSync(
      path.join(root, 'node_modules/.bin'),
      path.join(directory, 'node_modules/.bin')
    );
    const result = lint(language, [
      ...options,
      '--fix',
      `application.${extension}`,
      `packages/icons/selected.${extension}`,
    ]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(
      readFileSync(path.join(directory, `packages/icons/selected.${extension}`), 'utf8'),
      fixed
    );
    for (const file of [
      `packages/icons/unselected.${extension}`,
      `packages/scraps/selected.${extension}`,
      `packages/scraps/unselected.${extension}`,
    ]) {
      assert.equal(readFileSync(path.join(directory, file), 'utf8'), original);
    }
    if (language === 'js') {
      const ignored = lint(language, [...options, 'packages/icons/ignored.js']);
      assert.equal(ignored.status, 0, ignored.stdout + ignored.stderr);
    }
    const full = spawnSync('pnpm', ['run', `lint:${language}`, ...options, '--fix'], {
      cwd: path.join(directory, 'packages/icons'),
      encoding: 'utf8',
    });
    assert.equal(full.status, 0, full.stdout + full.stderr);
    assert.equal(
      readFileSync(
        path.join(directory, `packages/icons/unselected.${extension}`),
        'utf8'
      ),
      fixed
    );
  });
}

test('native package fixes reduce only checked suppression counts', t => {
  const {directory, write, lint} = fixture(t);
  const project = 'packages/icons';
  write(
    `${project}/package.json`,
    JSON.stringify({
      name: 'icons',
      scripts: {
        'lint:js': 'oxlint',
      },
    })
  );
  write(
    `${project}/.oxlintrc.json`,
    JSON.stringify({categories: {correctness: 'off'}, rules: {'no-debugger': 'error'}})
  );
  write(`${project}/other.js`, 'debugger;\n');
  write(`${project}/source.js`, 'debugger;\n');
  const original =
    JSON.stringify(
      {
        'other.js': {'no-debugger': {count: 1}},
        'source.js': {'no-debugger': {count: 1}},
      },
      null,
      2
    ) + '\n';
  write(`${project}/oxlint-suppressions.json`, original);
  mkdirSync(path.join(directory, 'node_modules'));
  symlinkSync(
    path.join(root, 'node_modules/.bin'),
    path.join(directory, 'node_modules/.bin')
  );
  const asset = () =>
    JSON.parse(
      readFileSync(path.join(directory, project, 'oxlint-suppressions.json'), 'utf8')
    );
  const fix = (file: string) => {
    const result = lint('js', ['--fix', 'application.js', `${project}/${file}`]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  fix('source.js');
  assert.deepEqual(asset(), JSON.parse(original));
  write(`${project}/source.js`, '');
  fix('source.js');
  assert.deepEqual(asset(), {'other.js': {'no-debugger': {count: 1}}});
  write(`${project}/other.js`, '');
  fix('other.js');
  assert.deepEqual(asset(), {});
  fix('other.js');
  assert.deepEqual(asset(), {});
});
