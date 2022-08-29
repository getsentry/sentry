import {useEffect} from 'react';

import {Organization} from 'sentry/types';

async function initSentryReplays() {
  const {SentryReplay} = await import('@sentry/replay');

  const replays = new SentryReplay({
    stickySession: true,
  });

  replays.setup();
}

/**
 * Load the Sentry Replay integration based on the feature flag.
 *
 *  Can't use `useOrganization` because it throws on
 * `/settings/account/api/auth-token/` because organization is not *immediately*
 * set in context
 */
export function SentryReplayInit({organization}: {organization: Organization | null}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || process.env.IS_ACCEPTANCE_TEST) {
      return;
    }

    if (!organization) {
      return;
    }

    if (!organization.features.includes('session-replay-sdk')) {
      return;
    }

    initSentryReplays();
  }, [organization]);

  return null;
}
