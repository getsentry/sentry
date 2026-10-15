import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
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
    `import {appendFileSync, readFileSync} from 'node:fs';
    const {name} = JSON.parse(readFileSync('package.json', 'utf8'));
    appendFileSync(${JSON.stringify(path.join(directory, 'runs.jsonl'))},
      JSON.stringify({name, args: process.argv.slice(2)}) + '\\n');
    process.exitCode = process.env.FAIL_WORKSPACE === name ? 1 : 0;`
  );
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
        env: {...process.env, FAIL_WORKSPACE: failWorkspace},
      });
      const runs = readFileSync(path.join(directory, 'runs.jsonl'), 'utf8')
        .trim()
        .split('\n')
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
    {name: 'icons', args: ['--quiet', 'src/example.tsx']},
  ]);
});

test('suppression maintenance and config inspection do not invoke package tasks', t => {
  for (const args of [['--ci', '--base', 'HEAD'], ['--prune'], ['--print-config']]) {
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

for (const language of ['js', 'css']) {
  test(`scoped ${language} fixes leave unselected files unchanged; package defaults scan all files`, t => {
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
            [`lint:${language}`]: manifest.scripts[`lint:${language}`]
              .replace('node ../../../scripts/lint.ts', `node ${runner}`)
              .replace('--type-aware ', ''),
          },
        })
      );
      write(
        `packages/${name}/.oxlintrc.json`,
        JSON.stringify({rules: {'no-var': 'error'}})
      );
      write(
        `packages/${name}/.stylelintrc.json`,
        JSON.stringify({rules: {'color-hex-length': 'short'}})
      );
      write(`packages/${name}/selected.${extension}`, original);
      write(`packages/${name}/unselected.${extension}`, original);
    }
    mkdirSync(path.join(directory, 'node_modules'));
    symlinkSync(
      path.join(root, 'node_modules/.bin'),
      path.join(directory, 'node_modules/.bin')
    );
    const result = lint(language, [
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
    const full = spawnSync('pnpm', ['run', `lint:${language}`, '--fix'], {
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

test('package fixes preserve canonical suppression bytes and format pruned budgets', t => {
  const {directory, write, lint} = fixture(t);
  const project = 'packages/icons';
  write(
    `${project}/package.json`,
    JSON.stringify({
      name: 'icons',
      scripts: {
        'lint:js': `node ${runner} js --local`,
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
    readFileSync(path.join(directory, project, 'oxlint-suppressions.json'), 'utf8');
  const fix = (file: string) => {
    const result = lint('js', ['--fix', 'application.js', `${project}/${file}`]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  fix('source.js');
  assert.equal(asset(), original);
  write(`${project}/source.js`, '');
  fix('source.js');
  assert.equal(
    asset(),
    '{\n  "other.js": {\n    "no-debugger": {\n      "count": 1\n    }\n  }\n}\n'
  );
  write(`${project}/other.js`, '');
  fix('other.js');
  assert(!existsSync(path.join(directory, project, 'oxlint-suppressions.json')));
  fix('other.js');
  assert(!existsSync(path.join(directory, project, 'oxlint-suppressions.json')));
});
