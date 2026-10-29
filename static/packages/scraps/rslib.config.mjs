import {pluginReact} from '@rsbuild/plugin-react';
import {defineConfig} from '@rslib/core';
import {pluginYak} from '@yak/react/rsbuild';

export default defineConfig({
  lib: [{format: 'esm', bundle: false, dts: {build: true}, syntax: 'es2022'}],
  source: {
    entry: {index: ['./src/**', '!src/**/*.spec.tsx', '!src/**/*.spec.ts']},
  },
  output: {target: 'web'},
  plugins: [
    pluginReact({swcReactOptions: {importSource: '@emotion/react'}}),
    pluginYak({strictCssProp: false}),
  ],
});
