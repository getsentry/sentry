module.exports = {
  extends: ['sentry-app/strict'],
  globals: {
    require: false,
    expect: false,
    sinon: false,
    MockApiClient: true,
    TestStubs: true,
    tick: true,
    jest: true,
  },
  rules: {
    'no-restricted-imports': [
      'error',
      {
        name: 'lodash/get',
        message:
          'Optional chaining `?.` and nullish coalescing operators `??` are available and preferred over using `lodash/get`',
      },
    ],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
  ],
};
