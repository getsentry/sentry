const strict = require('./.eslintrc.js');

module.exports = {
  ...strict,
  extends: ['sentry-app'],

  rules: {},

  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
  ],
};
