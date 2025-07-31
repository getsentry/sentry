import {useMemo} from 'react';

import {TrackingContextProvider} from 'sentry/components/core/trackingContext';
import HookStore from 'sentry/stores/hookStore';

export function SentryTrackingProvider({children}: {children: React.ReactNode}) {
  const useButtonTracking = HookStore.get('react-hook:use-button-tracking')[0];
  const trackingContextValue = useMemo(() => ({useButtonTracking}), [useButtonTracking]);

  return (
    <TrackingContextProvider value={trackingContextValue}>
      {children}
    </TrackingContextProvider>
  );
}
