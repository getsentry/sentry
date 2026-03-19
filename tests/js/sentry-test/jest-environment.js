const SentryEnvironment = require('@sentry/jest-environment/jsdom');

// @sentry/jest-environment mutates config.projectConfig.testEnvironmentOptions
// .sentryConfig.init in-place (pushing integrations and calling Sentry.init).
// When Jest runs in-band (≤1 test, e.g. via --changedSince), those mutations
// create circular references that crash ScriptTransformer's config serialisation.
// Deep-cloning sentryConfig isolates the mutation from the original config object.
class SafeSentryEnvironment extends SentryEnvironment {
  /** @param {import('@jest/environment').JestEnvironmentConfig} config @param {import('@jest/environment').EnvironmentContext} context */
  constructor(config, context) {
    const sentryConfig = config.projectConfig.testEnvironmentOptions?.sentryConfig;
    if (sentryConfig) {
      config = {
        ...config,
        projectConfig: {
          ...config.projectConfig,
          testEnvironmentOptions: {
            ...config.projectConfig.testEnvironmentOptions,
            sentryConfig: structuredClone(sentryConfig),
          },
        },
      };
    }
    super(config, context);
  }
}

module.exports = SafeSentryEnvironment;
