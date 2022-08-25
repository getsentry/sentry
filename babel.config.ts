/* eslint-env node */

import {TransformOptions} from '@babel/core';

const config: TransformOptions = {
  presets: [
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
      },
    ],
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: '3.22',
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [
    // NOTE: The order of the decorator and class-property plugins is important
    // here. Decorators must be processed first before class properties, see:
    // https://babeljs.io/docs/en/plugins#plugin-ordering
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    '@babel/plugin-proposal-class-properties',
  ],
};

export default config;
