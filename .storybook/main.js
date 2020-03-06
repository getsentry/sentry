/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
module.exports = {
  stories: ['../docs-ui/components/*.stories.*'],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {configureJSX: true},
    },
    '@storybook/addon-storysource',
    '@storybook/addon-knobs',
    '@storybook/addon-actions',
    '@storybook/addon-a11y',
    '@storybook/addon-options',
  ],
};
