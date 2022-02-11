module.exports = {
  extends: ['sentry-app/strict', 'plugin:escompat/typescript'],
  globals: {
    require: false,
    expect: false,
    sinon: false,
    MockApiClient: true,
    TestStubs: true,
    tick: true,
    jest: true,
  },

  rules: {},

  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
  ],
};
