import {pluginReact} from '@rsbuild/plugin-react';
import {defineConfig} from '@rslib/core';

export default defineConfig({
  lib: [{format: 'esm', bundle: false, dts: {build: true}, syntax: 'es2022'}],
  source: {
    entry: {index: ['./src/**', '!src/**/*.spec.tsx', '!src/**/*.spec.ts']},
  },
  output: {target: 'web'},
  plugins: [pluginReact({swcReactOptions: {importSource: '@emotion/react'}})],
});
