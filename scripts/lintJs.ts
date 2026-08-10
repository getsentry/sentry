import {spawn} from 'node:child_process';
import {existsSync, statSync} from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const oxlintPath = path.join(repositoryRoot, 'node_modules/.bin/oxlint');
const sentryTypeAnnotationLintPath = path.join(
  repositoryRoot,
  'scripts/lintSentryTypeAnnotations.ts'
);
const args = process.argv.slice(2);
const sourceFilePattern = /\.(?:[cm]?[jt]sx?|mdx)$/u;

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
  const inputPaths = args.filter(argument => {
    if (argument.startsWith('-')) {
      return false;
    }

    const absolutePath = path.resolve(repositoryRoot, argument);
    return (
      sourceFilePattern.test(argument) ||
      (existsSync(absolutePath) && statSync(absolutePath).isDirectory())
    );
  });

  commands.push(
    run(process.execPath, [
      sentryTypeAnnotationLintPath,
      ...(args.includes('--fix') ? ['--fix'] : []),
      ...inputPaths,
    ])
  );
}

const exitCodes = await Promise.all(commands);
process.exitCode = exitCodes.some(exitCode => exitCode !== 0) ? 1 : 0;
