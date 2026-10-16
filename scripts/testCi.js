import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

// pnpm runs scripts from each workspace directory. Resolve the processor before
// changing directories so every workspace can use the same CLI argument.
let args = process.argv.slice(2);
for (const [index, arg] of args.entries()) {
  const next = args[index + 1];
  if (arg === '--testResultsProcessor' && next) {
    args[index + 1] = resolve(next);
  } else if (arg.startsWith('--testResultsProcessor=')) {
    args[index] =
      '--testResultsProcessor=' + resolve(arg.slice('--testResultsProcessor='.length));
  }
}

if (
  args.some(arg =>
    /^--(?:findRelatedTests|find-related-tests|runTestsByPath|run-tests-by-path)(?:=|$)/.test(
      arg
    )
  )
) {
  const require = createRequire(new URL('../tests/js/package.json', import.meta.url));
  const {buildArgv, yargsOptions} = createRequire(require.resolve('jest/package.json'))(
    'jest-cli'
  );
  const parsed = await buildArgv(args);
  if (parsed.findRelatedTests || parsed.runTestsByPath) {
    if (parsed.testResultsProcessor) {
      parsed.testResultsProcessor = resolve(parsed.testResultsProcessor);
    }
    // Jest owns option parsing; only positional arguments are file paths.
    args = Object.entries(parsed).flatMap(([name, value]) =>
      Object.hasOwn(yargsOptions, name)
        ? (Array.isArray(value) ? value : [value]).map(item => `--${name}=${item}`)
        : []
    );
    args.push('--', ...Array.from(parsed._, file => resolve(String(file))));
  }
}

const result = spawnSync(
  'pnpm',
  [
    '--recursive',
    '--workspace-concurrency=2',
    '--aggregate-output',
    '--reporter=append-only',
    '--no-sort',
    '--no-bail',
    '--no-include-workspace-root',
    '--if-present',
    'run',
    'test',
    '--ci',
    '--watch=false',
    '--passWithNoTests',
    '--maxWorkers=2',
    '--watchman=false',
    '--colors',
    ...args,
  ],
  {stdio: 'inherit'}
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
