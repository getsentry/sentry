import {spawnSync} from 'node:child_process';

/**
 * @param {string} command
 * @param {string[]} args
 */
function runTests(command, args) {
  const result = spawnSync(command, args, {stdio: 'inherit'});
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

// A child process lets the package tests run even when Jest uses --forceExit.
const appStatus = runTests(process.execPath, [
  'scripts/test.js',
  '--ci',
  '--maxWorkers=75%',
  '--colors',
  ...process.argv.slice(2),
]);

let packageStatus = 0;
// Only one CI shard runs package tests. Local runs always include them.
if (
  !process.env.CI ||
  !process.env.CI_NODE_TOTAL ||
  !process.env.CI_NODE_INDEX ||
  process.env.CI_NODE_INDEX === '0'
) {
  packageStatus = runTests('pnpm', [
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
  ]);
}

process.exitCode = appStatus || packageStatus;
