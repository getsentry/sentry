import type * as React from 'react';
import {createContext, useContext} from 'react';

import type {ButtonVariant} from '@sentry/scraps/theme';

export interface AnalyticsProps {
  /**
   * Used when you want to overwrite the default Reload event key for analytics
   */
  analyticsEventKey?: string;
  /**
   * Used when you want to send an Amplitude Event. By default, Amplitude events are not sent so
   * you must pass in a eventName to send an Amplitude event.
   */
  analyticsEventName?: string;
  /**
   * Adds extra parameters to the analytics tracking
   */
  analyticsParams?: Record<string, unknown>;
}

type ClickTrackingType = 'button' | 'link';

interface ClickableProps<Element extends HTMLElement> extends AnalyticsProps {
  'aria-label'?: string;
  busy?: boolean;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<Element>;
  variant?: ButtonVariant;
}

export type TrackingProps = AnalyticsProps &
  Record<string, unknown> & {
    clickType: ClickTrackingType;
  };

const TrackingContext = createContext<(props: TrackingProps) => void>(() => {});

export const TrackingContextProvider = TrackingContext.Provider;

export const useClickTracking = <Element extends HTMLElement>(
  props: ClickableProps<Element>,
  clickType: ClickTrackingType
) => {
  const clickTracking = useContext(TrackingContext);
  const accessibleLabel =
    props['aria-label'] ??
    (typeof props.children === 'string' ? props.children : undefined);

  const handleClick = (e: React.MouseEvent<Element>) => {
    // Don't allow clicks when disabled or busy
    if (props.disabled || ('busy' in props && props.busy)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    clickTracking({
      clickType,
      analyticsEventName: props.analyticsEventName,
      analyticsEventKey: props.analyticsEventKey,
      analyticsParams: {
        variant: 'variant' in props ? props.variant : undefined,
        ...props.analyticsParams,
      },
      'aria-label': accessibleLabel || '',
    });
    props.onClick?.(e);
  };

  return {handleClick};
};
