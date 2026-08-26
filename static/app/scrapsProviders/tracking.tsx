import {
  TrackingContextProvider,
  type TrackingProps,
} from '@sentry/scraps/trackingContext';

import {getOverride} from 'sentry/overrideRegistry';

function useDefaultButtonTracking() {
  return (props: TrackingProps) => {
    const hasAnalyticsDebug = window.localStorage?.getItem('DEBUG_ANALYTICS') === '1';
    const hasCustomAnalytics =
      props.analyticsEventName || props.analyticsEventKey || props.analyticsParams;
    if (hasCustomAnalytics && hasAnalyticsDebug) {
      // eslint-disable-next-line no-console
      console.log('buttonAnalyticsEvent', {
        clickType: props.clickType,
        eventKey: props.analyticsEventKey,
        eventName: props.analyticsEventName,
        variant: props.variant,
        href: props.href,
        ...props.analyticsParams,
      });
    }
  };
}

export function SentryTrackingProvider({children}: {children: React.ReactNode}) {
  return (
    <TrackingContextProvider
      value={getOverride('react-hook:use-button-tracking') ?? useDefaultButtonTracking}
    >
      {children}
    </TrackingContextProvider>
  );
}
