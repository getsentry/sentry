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

/**
 * @param {string} command
 * @param {string[]} argv
 */
function runTests(command, argv, env = process.env) {
  const result = spawnSync(command, argv, {stdio: 'inherit', env});
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

/**
 * @param {string} filter
 * @param {string} version
 */
function runWorkspaceTests(filter, version) {
  return runTests(
    'pnpm',
    [
      '--recursive',
      '--workspace-concurrency=2',
      '--aggregate-output',
      '--reporter=append-only',
      '--no-sort',
      '--no-bail',
      '--no-include-workspace-root',
      '--filter',
      filter,
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
    {...process.env, SENTRY_REACT_ROUTER_VERSION: version}
  );
}

// Once production and previews use V8, remove the version selection.
const selectedVersion = process.env.SENTRY_REACT_ROUTER_VERSION;
if (selectedVersion !== undefined && !['6', '8'].includes(selectedVersion)) {
  throw new Error(`Unsupported SENTRY_REACT_ROUTER_VERSION: ${selectedVersion}`);
}
const versions = selectedVersion === undefined ? ['6', '8'] : [selectedVersion];
let appStatus = 0;
for (const version of versions) {
  console.log(`Testing with React Router v${version}`);
  const status = runWorkspaceTests('!./static/packages/*', version);
  appStatus ||= status;
}

let packageStatus = 0;
let routerBuildStatus = 0;
// After removing the router matrix, drop the V6 condition but keep the shard-0 guard.
if (
  (!process.env.CI || versions.includes('6')) &&
  (!process.env.CI ||
    !process.env.CI_NODE_TOTAL ||
    !process.env.CI_NODE_INDEX ||
    process.env.CI_NODE_INDEX === '0')
) {
  routerBuildStatus = runTests(process.execPath, [
    '--test',
    'build-utils/react-router.test.ts',
  ]);
  packageStatus = runWorkspaceTests('./static/packages/*', '6');
}

process.exitCode = appStatus || routerBuildStatus || packageStatus;
