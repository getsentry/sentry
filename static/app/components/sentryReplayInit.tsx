import {useEffect} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

async function initSentryReplays() {
  const {SentryReplay} = await import('@sentry/replay');

  const replays = new SentryReplay({
    stickySession: true,
  });

  replays.setup();
}

/**
 * Load the Sentry Replay integration based on the feature flag.
 */
export function SentryReplayInit() {
  const organization = useOrganization();

  useEffect(() => {
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
