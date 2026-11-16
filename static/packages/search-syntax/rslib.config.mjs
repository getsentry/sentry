import path from 'node:path';

import {defineConfig} from '@rslib/core';

export default defineConfig({
  lib: [{format: 'esm', bundle: false, dts: true, syntax: 'es2022'}],
  source: {
    entry: {
      index: ['./src/**', '!src/**/*.spec.ts', '!src/**/*.d.ts'],
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    target: 'web',
    // Types for the compiled grammar are written by hand.
    copy: [{from: './src/grammar.pegjs.d.ts'}],
  },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            test: /\.pegjs$/,
            use: [
              {
                loader: path.resolve(
                  import.meta.dirname,
                  '../../../build-utils/peggy-loader.ts'
                ),
              },
            ],
          },
        ],
      },
    },
  },
});
