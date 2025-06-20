import type {TransformOptions} from '@babel/core';

const config: TransformOptions = {
  presets: [
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
        importSource: '@emotion/react',
      },
    ],
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: '3.41',
        targets: {
          node: 'current',
        },
      },
    ],
    // TODO: Remove allowDeclareFields when we upgrade to Babel 8
    ['@babel/preset-typescript', {allowDeclareFields: true, onlyRemoveTypeImports: true}],
  ],
  plugins: [
    [
      '@emotion/babel-plugin',
      {
        sourceMap: false,
      },
    ],
  ],
};

export default config;
