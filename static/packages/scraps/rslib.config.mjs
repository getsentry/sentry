import {pluginReact} from '@rsbuild/plugin-react';
import {defineConfig} from '@rslib/core';

// eslint-disable-next-line import/no-relative-parent-imports
import {LINARIA_OPTIONS} from '../../../build-utils/linaria.ts';

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
        loader: '@wyw-in-js/webpack-loader',
        options: LINARIA_OPTIONS,
      });
    },
  },
});
