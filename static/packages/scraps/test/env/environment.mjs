import JSDOMEnvironment from '@jest/environment-jsdom-abstract';
import * as jsdom from 'jsdom';

// Jest loads environments through their default export.
// eslint-disable-next-line @sentry/no-default-exports
export default class ScrapsTestEnvironment extends JSDOMEnvironment {
  /**
   * @param {import('@jest/environment').JestEnvironmentConfig} config
   * @param {import('@jest/environment').EnvironmentContext} context
   */
  constructor(config, context) {
    super(config, context, jsdom);
  }
}
