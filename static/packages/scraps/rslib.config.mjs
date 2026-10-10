import path from 'node:path';

import {pluginReact} from '@rsbuild/plugin-react';
import {defineConfig} from '@rslib/core';

// eslint-disable-next-line import/no-relative-parent-imports
import {collectLinariaCss} from '../../../build-utils/linaria.ts';

export default defineConfig({
  lib: [{format: 'esm', bundle: false, dts: true, syntax: 'es2022'}],
  source: {
    entry: {index: ['./src/**', '!src/**/*.spec.tsx']},
  },
  output: {target: 'web'},
  plugins: [pluginReact({swcReactOptions: {importSource: '@emotion/react'}})],
  tools: {
    rspack: config => {
      config.module.rules.push({
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        enforce: 'pre',
        loader: path.resolve(
          import.meta.dirname,
          '../../../build-utils/linaria-loader.ts'
        ),
      });
      config.plugins.push({
        apply(compiler) {
          const {Compilation, sources} = compiler.webpack;
          compiler.hooks.thisCompilation.tap('LinariaStylesheet', compilation => {
            compilation.hooks.processAssets.tapPromise(
              {
                name: 'LinariaStylesheet',
                stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
              },
              async () => {
                const css = await collectLinariaCss([
                  path.resolve(import.meta.dirname, 'src'),
                ]);
                compilation.emitAsset('styles.css', new sources.RawSource(css));
              }
            );
          });
        },
      });
    },
  },
});
