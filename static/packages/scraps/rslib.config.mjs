import {pluginReact} from '@rsbuild/plugin-react';
import {defineConfig} from '@rslib/core';

export default defineConfig({
  lib: [{format: 'esm', bundle: false, dts: {build: true}, syntax: 'es2022'}],
  source: {
    entry: {
      index: ['./src/**', '!src/**/*.spec.tsx', '!src/**/*.spec.ts', '!src/**/*.mdx'],
    },
  },
  output: {target: 'web'},
  tools: {
    swc: {
      jsc: {
        // Component selectors, like `${Wrapper}:hover &`, need the class name
        // the plugin gives each styled component.
        experimental: {plugins: [['@swc/plugin-emotion', {}]]},
      },
    },
  },
  plugins: [pluginReact({swcReactOptions: {importSource: '@emotion/react'}})],
});
