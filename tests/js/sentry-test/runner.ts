import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

/**
 * Run the package CLI in a child process so Jest can exit without stopping the
 * caller. The child inherits the caller's working directory and environment.
 */
export function run(argv: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('../bin/test.mjs', import.meta.url)), ...argv],
      {stdio: 'inherit'}
    );
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
}
