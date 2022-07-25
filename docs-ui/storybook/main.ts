/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import path from 'path';

import {StorybookConfig} from '@storybook/core-common';

import babelConfig from '../../babel.config';

const toPath = (p: string) => path.join(process.cwd(), p);

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.*'],
  framework: '@storybook/react',
  core: {
    builder: 'webpack5',
  },
  addons: [
    {
      name: '@storybook/addon-essentials',
      options: {},
    },
    '@storybook/addon-a11y',
    '@storybook/addon-links',
    '@storybook/addon-docs',
    'storybook-dark-mode',
  ],

  features: {
    emotionAlias: false,
    babelModeV7: true,
  },

  // For whatever reason the `babel` config override is not present in
  // storybooks StorybookConfig type.
  //
  // See https://github.com/storybookjs/storybook/issues/15502
  //
  // @ts-expect-error
  babel: babelConfig,

  // XXX(emotion11): Workaround because storybook still uses emotion 10
  // internally. See https://github.com/storybookjs/storybook/issues/13145
  webpackFinal: webpackConf => ({
    ...webpackConf,
    resolve: {
      ...webpackConf?.resolve,
      alias: {
        ...webpackConf?.resolve?.alias,
        '@emotion/core': toPath('node_modules/@emotion/react'),
        '@emotion/styled': toPath('node_modules/@emotion/styled'),
        'emotion-theming': toPath('node_modules/@emotion/react'),
        '@babel/preset-react': toPath('node_modules/@babel/preset-react'),
      },
      // See: https://github.com/storybookjs/storybook/issues/17458
      fallback: {
        ...webpackConf?.resolve?.fallback,
        assert: toPath('commonjs-assert'),
      },
    },
  }),
};

export default config;
