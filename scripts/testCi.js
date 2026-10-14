import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// pnpm runs scripts from each workspace directory. Resolve the processor before
// changing directories so every workspace can use the same CLI argument.
const args = process.argv.slice(2);
for (const [index, arg] of args.entries()) {
  const next = args[index + 1];
  if (arg === '--testResultsProcessor' && next) {
    args[index + 1] = resolve(next);
  } else if (arg.startsWith('--testResultsProcessor=')) {
    args[index] =
      '--testResultsProcessor=' + resolve(arg.slice('--testResultsProcessor='.length));
  }
}

const result = spawnSync(
  'pnpm',
  [
    '--recursive',
    '--workspace-concurrency=2',
    '--stream',
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
