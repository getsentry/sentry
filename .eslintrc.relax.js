const strict = require('./.eslintrc.js');

module.exports = {
  ...strict,
  extends: ['sentry-app'],

  rules: {
    'emotion/jsx-import': 'off',
    'emotion/no-vanilla': 'warn',
    'emotion/import-from-emotion': 'error',
    'emotion/styled-import': 'error',
  },
};
