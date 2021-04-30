const strict = require('./.eslintrc.js');

module.exports = {
  ...strict,
  extends: ['sentry-app'],

  rules: {},

  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/jsx-uses-react': 'off'
      },
    },
  ],
};
