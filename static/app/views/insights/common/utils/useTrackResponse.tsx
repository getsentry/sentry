import {useEffect, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Tracks how long a query took to load, once per loading cycle.
 */
export function useTrackResponse(
  {isLoading, statusCode}: {isLoading: boolean; statusCode?: string},
  enabled: boolean
) {
  const organization = useOrganization();
  const startTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isLoading) {
      if (startTimestampRef.current === null) {
        startTimestampRef.current = Date.now();
      }
      return;
    }

    const startTimestamp = startTimestampRef.current;
    if (startTimestamp === null) {
      return;
    }

    startTimestampRef.current = null;
    trackAnalytics('starfish.request', {
      organization,
      duration: Date.now() - startTimestamp,
      statusCode,
    });
  }, [enabled, isLoading, organization, statusCode]);
}
