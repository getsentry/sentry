// @sentry/jest-environment applies `sentryConfig.tags` with Sentry.setTags(), which
// only reaches error events. SDK v11 streams spans, and streamed spans carry scope
// *attributes* rather than tags, so without this the `ci.*` tags are missing from
// every span (suite, test, describe, test-fn and hooks) in the `jest` project.
// Mirroring them onto the global scope as attributes makes each span queryable by them.

/**
 * @typedef {{getGlobalScope(): {setAttributes(attributes: Record<string, unknown>): unknown}}} SentryLike
 */

/** @param {typeof import('@jest/environment').JestEnvironment} SentryEnvironment */
function withTagsAsSpanAttributes(SentryEnvironment) {
  return class SentryEnvironmentWithSpanAttributes extends SentryEnvironment {
    /** @param {import('@jest/environment').JestEnvironmentConfig} config @param {import('@jest/environment').EnvironmentContext} context */
    constructor(config, context) {
      super(config, context);

      // `sentry` is only set once the environment has initialized the SDK, i.e. when
      // reporting is enabled. Use that instance rather than requiring @sentry/node
      // here, which could resolve to a different copy of the SDK.
      const {sentry} = /** @type {{sentry?: SentryLike}} */ (
        /** @type {unknown} */ (this)
      );
      const sentryConfig = /** @type {{tags?: Record<string, unknown>} | undefined} */ (
        config.projectConfig.testEnvironmentOptions?.sentryConfig
      );
      const tags = sentryConfig?.tags;
      if (sentry && tags) {
        sentry.getGlobalScope().setAttributes(tags);
      }
    }
  };
}

module.exports = withTagsAsSpanAttributes;
