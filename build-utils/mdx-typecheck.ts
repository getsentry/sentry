import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createMdxLanguagePlugin} from '@mdx-js/language-service';
import {runTsc} from '@volar/typescript/lib/quickstart/runTsc.js';

import {remarkPlugins} from './mdx-plugins.ts';

// Point to the MDX-specific tsconfig at the repo root
process.argv.push(
  '--project',
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tsconfig.mdx.json')
);

// Run TypeScript through Volar for `.mdx` files. `typescript` resolves to the
// TS6 compatibility package, whose tsc entrypoint is a shim that Volar cannot
// patch directly, so point Volar at the real TS6 compiler implementation.
runTsc(
  fileURLToPath(import.meta.resolve('@typescript/old/lib/tsc.js')),
  ['.mdx'],
  () => ({
    languagePlugins: [
      createMdxLanguagePlugin(
        remarkPlugins,
        [], // virtualCodePlugins
        true, // checkMdx
        'react'
      ),
    ],
  })
);
