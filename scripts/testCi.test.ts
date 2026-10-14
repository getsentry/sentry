import assert from 'node:assert/strict';
import {execFile, spawnSync} from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const exec = promisify(execFile);

function fixture(t: {after: (cleanup: () => void) => void}) {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'workspace-test-ci-')));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const write = (file: string, contents: string) => {
    mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
    writeFileSync(path.join(directory, file), contents);
  };
  const copy = (file: string) => {
    mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
    copyFileSync(path.join(root, file), path.join(directory, file));
  };
  write('package.json', '{"private":true,"type":"module"}');
  symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: '',
    CI_NODE_TOTAL: '',
    CI_NODE_INDEX: '',
  };
  return {directory, write, copy, env};
}

test('CI runner discovers workspace scripts, forwards arguments, and returns failures', t => {
  const {directory, write, env} = fixture(t);
  const capture = path.join(directory, 'args.json');
  write(
    'bin/pnpm',
    `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';\nwriteFileSync(${JSON.stringify(capture)}, JSON.stringify(process.argv.slice(2)));\nprocess.exit(7);\n`
  );
  // Use an executable fake pnpm without running any workspace suites.
  chmodSync(path.join(directory, 'bin/pnpm'), 0o755);
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/testCi.js'),
      '--forceExit',
      '--testResultsProcessor',
      './tests/js/test-balancer/resultsProcessor.ts',
      'components/avatar.spec.tsx',
    ],
    {cwd: directory, env: {...env, PATH: path.join(directory, 'bin') + ':' + env.PATH}}
  );
  assert.equal(result.status, 7, result.stderr?.toString());
  const args: string[] = JSON.parse(readFileSync(capture, 'utf8'));
  assert.ok(args.includes('--recursive'));
  assert.ok(args.includes('--no-include-workspace-root'));
  assert.ok(args.includes('--if-present'));
  assert.ok(args.includes('--no-bail'));
  assert.ok(args.includes('--watch=false'));
  assert.ok(!args.includes('--filter'));
  assert.deepEqual(args.slice(-4), [
    '--forceExit',
    '--testResultsProcessor',
    path.join(directory, 'tests/js/test-balancer/resultsProcessor.ts'),
    'components/avatar.spec.tsx',
  ]);

  const inline = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/testCi.js'),
      '--testResultsProcessor=./tests/js/test-balancer/resultsProcessor.ts',
    ],
    {cwd: directory, env: {...env, PATH: path.join(directory, 'bin') + ':' + env.PATH}}
  );
  assert.equal(inline.status, 7, inline.stderr?.toString());
  const inlineArgs: string[] = JSON.parse(readFileSync(capture, 'utf8'));
  assert.equal(
    inlineArgs.at(-1),
    '--testResultsProcessor=' +
      path.join(directory, 'tests/js/test-balancer/resultsProcessor.ts')
  );
});

test('standalone package configs discover tests only on shard zero', async t => {
  const {directory, copy, env} = fixture(t);
  copy('scripts/jestSingleShard.js');
  for (const name of ['icons', 'scraps']) {
    const config = `static/packages/${name}/jest.config.mjs`;
    copy(config);
    const source = `import config from ${JSON.stringify(path.join(directory, config))}; process.stdout.write(JSON.stringify(config.testMatch));`;
    for (const shard of ['', '0', '1']) {
      const result = await exec(process.execPath, ['--input-type=module', '-e', source], {
        env: {...env, CI: shard ? 'true' : '', CI_NODE_TOTAL: '2', CI_NODE_INDEX: shard},
      });
      assert.deepEqual(JSON.parse(result.stdout), [
        shard === '1'
          ? '<rootDir>/__no_tests_for_this_shard__'
          : '<rootDir>/src/**/*.spec.tsx',
      ]);
    }
  }
});

test('scoped workspaces preserve the global shard assignment with and without history', async t => {
  const {directory, write, copy, env} = fixture(t);
  copy('tests/js/createJestConfig.ts');
  const workspaces = [
    'static/app',
    'static/gsApp',
    'static/gsAdmin',
    'static/oxlint/eslintPluginSentry',
    'static/oxlint/eslintPluginScraps',
    'tests/js',
  ];
  const files = workspaces.map(workspace => '/' + workspace + '/example.spec.ts');
  write('jest-test-files.json', JSON.stringify(files.map(file => directory + file)));
  const source = `
    import {createJestConfig} from './tests/js/createJestConfig.ts';
    const config = createJestConfig();
    const workspaces = ${JSON.stringify(workspaces)};
    const files = ${JSON.stringify(files)};
    const matches = Object.fromEntries(workspaces.map(workspace => {
      const scoped = createJestConfig(workspace);
      const selected = files.filter(file =>
        scoped.testMatch.includes('<rootDir>' + file) &&
        !scoped.testPathIgnorePatterns.some(pattern => new RegExp(pattern.replace('<rootDir>', ${JSON.stringify(directory)})).test(${JSON.stringify(directory)} + file))
      );
      return [workspace, selected];
    }));
    process.stdout.write(JSON.stringify({global: config.testMatch, matches}));
  `;
  for (const history of [false, true]) {
    if (history) {
      write(
        'tests/js/test-balancer/jest-balance.json',
        JSON.stringify({
          ...Object.fromEntries(files.map(file => [file, 1000])),
          '/static/packages/icons/unbalanced.spec.tsx': 1_000_000,
        })
      );
    }
    const seen: string[] = [];
    const shardSizes: number[] = [];
    for (const shard of ['0', '1']) {
      const result = await exec(process.execPath, ['--input-type=module', '-e', source], {
        cwd: directory,
        env: {...env, CI: 'true', CI_NODE_TOTAL: '2', CI_NODE_INDEX: shard},
      });
      const data: {global: string[]; matches: Record<string, string[]>} = JSON.parse(
        result.stdout
      );
      const selected = Object.values(data.matches).flat();
      assert.deepEqual(
        selected.map(file => '<rootDir>' + file).sort(),
        data.global.slice().sort()
      );
      for (const [workspace, matches] of Object.entries(data.matches)) {
        assert.ok(matches.every(file => file.startsWith('/' + workspace + '/')));
      }
      shardSizes.push(selected.length);
      seen.push(...selected);
    }
    assert.deepEqual(shardSizes, [3, 3]);
    assert.deepEqual(seen.sort(), files.slice().sort());
  }
});

test('an empty shard does not fall back to running all workspace tests', async t => {
  const {directory, write, copy, env} = fixture(t);
  copy('tests/js/createJestConfig.ts');
  write('jest-test-files.json', JSON.stringify([directory + '/static/app/one.spec.ts']));
  const result = await exec(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {createJestConfig} from './tests/js/createJestConfig.ts'; process.stdout.write(JSON.stringify(createJestConfig('static/app').testMatch));`,
    ],
    {
      cwd: directory,
      env: {...env, CI: 'true', CI_NODE_TOTAL: '2', CI_NODE_INDEX: '1'},
    }
  );
  assert.deepEqual(JSON.parse(result.stdout), ['<rootDir>/__no_tests_for_this_shard__']);

  write('jest-test-files.json', '[]');
  for (const history of [false, true]) {
    if (history) {
      write('tests/js/test-balancer/jest-balance.json', '{}');
    }
    const empty = await exec(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import {createJestConfig} from './tests/js/createJestConfig.ts'; process.stdout.write(JSON.stringify(createJestConfig('static/app').testMatch));`,
      ],
      {
        cwd: directory,
        env: {...env, CI: 'true', CI_NODE_TOTAL: '2', CI_NODE_INDEX: '0'},
      }
    );
    assert.deepEqual(JSON.parse(empty.stdout), ['<rootDir>/__no_tests_for_this_shard__']);
  }
});

test('parallel workspace reports retain repository paths and combine without overwrites', async t => {
  const {directory, write, copy, env} = fixture(t);
  copy('tests/js/test-balancer/resultsProcessor.ts');
  copy('tests/js/test-balancer/combine.ts');
  const workspaces = ['static/app', 'static/gsApp'];
  await Promise.all(
    workspaces.map(async workspace => {
      write(workspace + '/example.spec.ts', '');
      const processor = path.join(
        directory,
        'tests/js/test-balancer/resultsProcessor.ts'
      );
      const source = `
        import writeReport from ${JSON.stringify(processor)};
        writeReport({testResults: [
          {testFilePath: ${JSON.stringify(path.join(directory, workspace, 'example.spec.ts'))}, numFailingTests: 0, perfStats: {runtime: 123}},
          {testFilePath: ${JSON.stringify(path.join(directory, workspace, 'failed.spec.ts'))}, numFailingTests: 1, perfStats: {runtime: 999}}
        ]});
      `;
      await exec(process.execPath, ['--input-type=module', '-e', source], {
        cwd: path.join(directory, workspace),
        env,
      });
    })
  );
  const reportDirectory = path.join(directory, '.artifacts/jest-balance');
  assert.equal(readdirSync(reportDirectory).length, 2);
  for (const workspace of workspaces) {
    const filename = encodeURIComponent(workspace) + '.json';
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(reportDirectory, filename), 'utf8')),
      {
        ['/' + workspace + '/example.spec.ts']: 123,
      }
    );
    write(
      'artifacts/jest-balance-0/' + filename,
      readFileSync(path.join(reportDirectory, filename), 'utf8')
    );
  }
  await exec(process.execPath, ['tests/js/test-balancer/combine.ts', 'artifacts'], {
    cwd: directory,
    env,
  });
  assert.deepEqual(
    JSON.parse(readFileSync(path.join(directory, 'jest-balance.json'), 'utf8')),
    {
      '/static/app/example.spec.ts': 123,
      '/static/gsApp/example.spec.ts': 123,
    }
  );
});
