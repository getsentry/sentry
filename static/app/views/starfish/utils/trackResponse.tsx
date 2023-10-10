import {useEffect, useState} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import useOrganization from 'sentry/utils/useOrganization';

export function TrackResponse(
  eventView: EventView,
  {isLoading, statusCode}: {isLoading: boolean; statusCode?: string}
) {
  // Get current timestamp
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [initiallyLoaded, setInitiallyLoaded] = useState(false);
  const organization = useOrganization();

  useEffect(() => {
    if (isLoading) {
      if (startTimestamp === null) {
        setStartTimestamp(Date.now());
        setInitiallyLoaded(false);
      }
      return;
    }
    if (initiallyLoaded) {
      return;
    }

    setInitiallyLoaded(true);
    if (startTimestamp) {
      const now = Date.now();
      trackAnalytics('starfish.request', {
        organization,
        duration: now - startTimestamp,
        statusCode,
      });
      setStartTimestamp(null);
    }
  }, [initiallyLoaded, eventView, startTimestamp, organization, isLoading, statusCode]);
}
