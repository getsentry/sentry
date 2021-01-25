/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
module.exports = {
  stories: ['../docs-ui/components/*.stories.*'],
  addons: [
    {
      name: '@storybook/addon-essentials',
      options: {},
    },
  ],
};
