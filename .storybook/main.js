/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const path = require('path');

const toPath = p => path.join(process.cwd(), p);

module.exports = {
  stories: ['../docs-ui/components/*.stories.*'],
  core: {
    builder: 'webpack5',
  },
  addons: [
    {
      name: '@storybook/addon-essentials',
      options: {},
    },
    '@storybook/addon-a11y',
  ],

  // XXX(emotion11): Workaround because storybook still uses emotion 10
  // internally. See https://github.com/storybookjs/storybook/issues/13145
  webpackFinal: async config => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          '@emotion/core': toPath('node_modules/@emotion/react'),
          '@emotion/styled': toPath('node_modules/@emotion/styled'),
          'emotion-theming': toPath('node_modules/@emotion/react'),
          '@babel/preset-react': toPath('node_modules/@babel/preset-react'),
        },
      },
    };
  },
};
