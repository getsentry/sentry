import {useMemo} from 'react';

import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

import {getOverride} from 'sentry/overrideRegistry';

export function SentryTrackingProvider({children}: {children: React.ReactNode}) {
  const useButtonTracking = getOverride('react-hook:use-button-tracking');
  const trackingContextValue = useMemo(() => ({useButtonTracking}), [useButtonTracking]);

  return (
    <TrackingContextProvider value={trackingContextValue}>
      {children}
    </TrackingContextProvider>
  );
}
