import {spawnSync} from 'node:child_process';

/**
 * @param {string} command
 * @param {string[]} args
 */
function runTests(command, args, env = process.env) {
  const result = spawnSync(command, args, {stdio: 'inherit', env});
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

// A child process lets the package tests run even when Jest uses --forceExit.
const selectedVersion = process.env.SENTRY_REACT_ROUTER_VERSION;
if (selectedVersion !== undefined && !['6', '8'].includes(selectedVersion)) {
  throw new Error(`Unsupported SENTRY_REACT_ROUTER_VERSION: ${selectedVersion}`);
}
const versions = selectedVersion === undefined ? ['6', '8'] : [selectedVersion];
let appStatus = 0;
for (const version of versions) {
  console.log(`Testing with React Router v${version}`);
  const status = runTests(
    process.execPath,
    ['scripts/test.js', '--ci', '--maxWorkers=75%', '--colors', ...process.argv.slice(2)],
    {...process.env, SENTRY_REACT_ROUTER_VERSION: version}
  );
  appStatus ||= status;
}

let packageStatus = 0;
let routerBuildStatus = 0;
// Only one CI shard runs package tests. Local runs always include them.
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
  packageStatus = runTests(
    'pnpm',
    [
      '--recursive',
      '--parallel',
      '--no-bail',
      '--filter',
      './static/packages/*',
      '--if-present',
      'run',
      'test',
      '--ci',
      '--maxWorkers=2',
      '--watchman=false',
    ],
    {...process.env, SENTRY_REACT_ROUTER_VERSION: '6'}
  );
}

process.exitCode = appStatus || routerBuildStatus || packageStatus;
