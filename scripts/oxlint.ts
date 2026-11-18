import {fileURLToPath} from 'node:url';

const cli = new URL('cli.js', import.meta.resolve('oxlint'));
process.env.OXLINT_TSGOLINT_PATH = fileURLToPath(
  new URL('bin/tsrs-lint', import.meta.resolve('tsrs/package.json'))
);
process.argv[1] = fileURLToPath(cli);
await import(cli.href);
