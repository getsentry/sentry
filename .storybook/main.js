/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
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
};
