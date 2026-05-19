import {useMemo} from 'react';

import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

import {getHook} from 'sentry/hookRegistry';

export function SentryTrackingProvider({children}: {children: React.ReactNode}) {
  const useButtonTracking = getHook('react-hook:use-button-tracking');
  const trackingContextValue = useMemo(() => ({useButtonTracking}), [useButtonTracking]);

  return (
    <TrackingContextProvider value={trackingContextValue}>
      {children}
    </TrackingContextProvider>
  );
}
