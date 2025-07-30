import {createContext, useContext} from 'react';

import type {DO_NOT_USE_ButtonProps as ButtonProps} from './button/types';

const defaultButtonTracking = (props: ButtonProps) => {
  const hasAnalyticsDebug = window.localStorage?.getItem('DEBUG_ANALYTICS') === '1';
  return () => {
    const hasCustomAnalytics =
      props.analyticsEventName || props.analyticsEventKey || props.analyticsParams;
    if (hasCustomAnalytics && hasAnalyticsDebug) {
      // eslint-disable-next-line no-console
      console.log('buttonAnalyticsEvent', {
        eventKey: props.analyticsEventKey,
        eventName: props.analyticsEventName,
        priority: props.priority,
        href: 'href' in props ? props.href : undefined,
        ...props.analyticsParams,
      });
    }
  };
};

const TrackingContext = createContext<{
  useButtonTracking?: (props: ButtonProps) => () => void;
}>({});

export const TrackingContextProvider = TrackingContext.Provider;

export const useButtonTracking = (props: ButtonProps) => {
  const context = useContext(TrackingContext);

  return context.useButtonTracking?.(props) ?? defaultButtonTracking(props);
};
