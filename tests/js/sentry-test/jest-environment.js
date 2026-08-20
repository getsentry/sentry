const BaseJSDOMEnvironment = require('@jest/environment-jsdom-abstract').default;
const {createEnvironment} = require('@sentry/jest-environment');
const jsdom = require('jsdom');

const wrapWithStructuredClone = require('./wrapWithStructuredClone');

class VirtualConsole extends jsdom.VirtualConsole {
  /**
   * @param {Console} targetConsole
   * @param {{jsdomErrors?: 'none' | 'all' | string[]}} [options]
   */
  forwardTo(targetConsole, options) {
    // Jest handles jsdom errors separately so it can respect
    // testEnvironmentOptions. Forwarding them here would log each error twice.
    // @ts-expect-error forwardTo was added after the latest published @types/jsdom.
    return super.forwardTo(targetConsole, {...options, jsdomErrors: 'none'});
  }
}

class JSDOMEnvironment extends BaseJSDOMEnvironment {
  /** @param {import('@jest/environment').JestEnvironmentConfig} config @param {import('@jest/environment').EnvironmentContext} context */
  constructor(config, context) {
    super(config, context, {...jsdom, VirtualConsole});
  }
}

const SentryJSDOMEnvironment = createEnvironment({
  baseEnvironment: {TestEnvironment: JSDOMEnvironment},
});

module.exports = wrapWithStructuredClone(SentryJSDOMEnvironment);
