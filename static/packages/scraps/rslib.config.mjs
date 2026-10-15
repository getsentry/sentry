import {pluginReact} from '@rsbuild/plugin-react';
import {defineConfig} from '@rslib/core';

export default defineConfig({
  lib: [{format: 'esm', bundle: false, dts: true, syntax: 'es2022'}],
  source: {
    entry: {index: ['./src/**', '!src/**/*.spec.tsx']},
  },
  output: {target: 'web'},
  plugins: [pluginReact({swcReactOptions: {importSource: '@emotion/react'}})],
});
