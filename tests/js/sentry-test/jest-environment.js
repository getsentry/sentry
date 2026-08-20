const BaseJSDOMEnvironment = require('@jest/environment-jsdom-abstract').default;
const {createEnvironment} = require('@sentry/jest-environment');
const jsdom = require('jsdom');

const wrapWithStructuredClone = require('./wrapWithStructuredClone');

class JSDOMEnvironment extends BaseJSDOMEnvironment {
  /** @param {import('@jest/environment').JestEnvironmentConfig} config @param {import('@jest/environment').EnvironmentContext} context */
  constructor(config, context) {
    super(config, context, jsdom);
  }
}

const SentryJSDOMEnvironment = createEnvironment({
  baseEnvironment: {TestEnvironment: JSDOMEnvironment},
});

module.exports = wrapWithStructuredClone(SentryJSDOMEnvironment);
