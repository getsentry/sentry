/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

const {SENTRY_INSTRUMENTATION, IS_ACCEPTANCE_TEST} = process.env;

async function initSentryReplays() {
  const {SentryReplay} = await import('@sentry/replay');

  const replays = new SentryReplay({
    stickySession: true,
  });

  replays.start();
}

/**
 * Load the Sentry Replay integration based on the feature flag.
 *
 *  Can't use `useOrganization` because it throws on
 * `/settings/account/api/auth-token/` because organization is not *immediately*
 * set in context
 */
export function SentryReplayInit() {
  if (!(IS_ACCEPTANCE_TEST && SENTRY_INSTRUMENTATION)) {
    return null;
  }
  initSentryReplays();
  return null;
}
