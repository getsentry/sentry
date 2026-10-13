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
  // Called here, not in `useClickTracking`, so a Button's hook count doesn't
  // depend on which implementation is registered.
  const useButtonTracking =
    getOverride('react-hook:use-button-tracking') ?? useDefaultButtonTracking; // oxlint-disable-line react/hooks -- Hook comes from the override registry, which is populated before React renders.

  return (
    <TrackingContextProvider
      // oxlint-disable-next-line react/hooks -- Hook comes from the override registry, which is populated before React renders.
      value={useButtonTracking()}
    >
      {children}
    </TrackingContextProvider>
  );
}
