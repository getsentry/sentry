import {useMemo} from 'react';

import {TrackingContextProvider} from 'sentry/components/core/trackingContext';

import useButtonTracking from 'getsentry/hooks/useButtonTracking';

function SentryHooksProvider({children}: {children?: React.ReactNode}) {
  const buttonTracking = useButtonTracking();
  const trackingContextValue = useMemo(() => ({buttonTracking}), [buttonTracking]);

  return (
    <TrackingContextProvider value={trackingContextValue}>
      {children}
    </TrackingContextProvider>
  );
}

export default SentryHooksProvider;
