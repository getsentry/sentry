import {useState} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';

type KeyType = Parameters<typeof trackAnalytics>[0];

/**
 * trackAnalytics wrapper. Idempotent from the last parent component mount.
 */
export default function useDebouncedAnalytics(): {
  trackAnalytics: typeof trackAnalytics;
} {
  const [emitted, setEmitted] = useState<Set<KeyType>>(new Set());
  const debouncedTrackAnalytics = (
    eventKey: KeyType,
    analyticsParams: Parameters<typeof trackAnalytics>[1],
    options?: Parameters<typeof trackAnalytics>[2]
  ) => {
    if (emitted.has(eventKey)) {
      return;
    }
    trackAnalytics(eventKey, analyticsParams, options);
    setEmitted(emitted.union(new Set([eventKey])));
  };

  return {trackAnalytics: debouncedTrackAnalytics};
}
