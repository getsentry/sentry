/*eslint-env node*/
module.exports = {
  extends: ['sentry-app'],
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
};
