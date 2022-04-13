/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

const path = require('path');

module.exports = {
  parserOptions: {
    sourceType: 'module',
  },
  env: {
    node: true,
    es6: true,
  },
  settings: {
    'import/resolver': {
      webpack: {
        config: path.join(__dirname, './storybook/webpack.config.ts'),
      },
    },
    'import/extensions': ['.js', '.jsx'],
  },
  overrides: [
    {
      files: ['**/*.stories.js'],
      rules: {
        // XXX(epurkhiser): The storybook CSF requires anonymous default
        // exportsthis, see [0].
        //
        // [0]: https://github.com/storybookjs/storybook/issues/12914
        'import/no-anonymous-default-export': 'off',
      },
    },
  ],
};
