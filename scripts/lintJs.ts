import {spawn} from 'node:child_process';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const oxlintPath = path.join(repositoryRoot, 'node_modules/.bin/oxlint');
const sentryTypeAwareLintPath = path.join(
  repositoryRoot,
  'scripts/lintSentryTypeAware.ts'
);
const args = process.argv.slice(2);

function run(command: string, commandArgs: string[]): Promise<number> {
  const child = spawn(command, commandArgs, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
  });

  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

const informationalRun = args.some(argument =>
  ['--help', '-h', '--version', '-V', '--rules', '--print-config', '--init'].includes(
    argument
  )
);
const oxlintArgs = args.includes('--type-aware') ? args : ['--type-aware', ...args];
const commands = [run(oxlintPath, oxlintArgs)];

if (!informationalRun) {
  commands.push(run(process.execPath, [sentryTypeAwareLintPath, ...args]));
}

const exitCodes = await Promise.all(commands);
process.exitCode = exitCodes.some(exitCode => exitCode !== 0) ? 1 : 0;
