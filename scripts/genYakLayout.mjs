/* eslint-disable import/no-nodejs-modules */
import {Buffer} from 'node:buffer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import {transform} from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const filename = path.join(root, 'static/packages/scraps/src/layout/yakStyles.yak.ts');
const source = await fs.readFile(filename, 'utf8');
const sizes = await fs.readFile(
  path.join(root, 'static/packages/scraps/src/tokens/size.tsx'),
  'utf8'
);
const {code} = await transform(sizes, {loader: 'tsx', format: 'esm'});
const {size} = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
// The property list is maintained in the Yak module. Refresh only the scales,
// directly from the same generated tokens used by the existing responsive API.
const output = source
  .replace(
    /const container = \{[\s\S]*?\n\};/,
    `const container = ${JSON.stringify(size.container, null, 2)};`
  )
  .replace(
    /const viewport = \{[\s\S]*?\n\};/,
    `const viewport = ${JSON.stringify(size.breakpoints, null, 2)};`
  );
await fs.writeFile(filename, output);
execFileSync('pnpm', ['exec', 'oxfmt', filename], {cwd: root, stdio: 'inherit'});
