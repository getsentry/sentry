import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/typesBase';

export interface OnDemandControlContext {
  setForceOnDemand: (value: boolean) => void;
  forceOnDemand?: boolean;
  isControlEnabled?: boolean;
}

const OnDemandControlContext = createContext<OnDemandControlContext | undefined>(
  undefined
);

export function useOnDemandControl(): OnDemandControlContext | undefined {
  return useContext(OnDemandControlContext);
}

export function OnDemandControlProvider({
  children,
  location,
}: {
  children: ReactNode;
  location: Location;
}) {
  const _forceOnDemandQuery = location?.query.forceOnDemand;
  const _forceOnDemand =
    _forceOnDemandQuery === 'true'
      ? true
      : _forceOnDemandQuery === 'false'
        ? false
        : undefined;
  const navigate = useNavigate();
  const [isControlEnabled, setIsControlEnabled] = useState(_forceOnDemand !== undefined);
  const [forceOnDemand, _setForceOnDemand] = useState(_forceOnDemand || false);

  const setForceOnDemand = useCallback(
    (value: boolean) => {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            forceOnDemand: value,
          },
        },
        {replace: true}
      );
      _setForceOnDemand(value);
      setIsControlEnabled(true);
    },
    [navigate, setIsControlEnabled, _setForceOnDemand, location]
  );

  return (
    <OnDemandControlContext value={{setForceOnDemand, isControlEnabled, forceOnDemand}}>
      {children}
    </OnDemandControlContext>
  );
}
/**
 * We determine that a widget is an on-demand metric widget if the widget
 * 1. Widget Type is discover
 * 2. contains one of the keys that are not supported by standard metrics or conditions that
 *    can't be on-demand because they are part of errors. (eg. error.type, message, stack, etc.)
 */
export function isOnDemandMetricWidget(widget: Widget): boolean {
  if (
    !(
      widget.widgetType === WidgetType.DISCOVER ||
      widget.widgetType === WidgetType.TRANSACTIONS
    )
  ) {
    return false;
  }

  const conditions = widget.queries.flatMap(query => query.conditions);

  const hasConditions = conditions.length > 0; // In cases with custom column like user_misery, on-demand can still apply.
  const hasOnDemandConditions = conditions.some(condition =>
    isOnDemandQueryString(condition)
  );

  if (!hasOnDemandConditions && hasConditions) {
    return false;
  }

  return true;
}

/**
 * On-demand doesn't include 'release'
 */
const doesWidgetHaveReleaseConditions = (widget: Widget) =>
  widget.queries.some(q => q.conditions.includes('release:'));

/**
 * Check the extraction state for any widgets exceeding spec limit / cardinality limit etc.
 */
const doesWidgetHaveDisabledOnDemand = (widget: Widget) =>
  widget.queries.some(q => q.onDemand?.some(d => !d.enabled));

export const shouldUseOnDemandMetrics = (
  organization: Organization,
  widget: Widget,
  onDemandControlContext?: OnDemandControlContext
) => {
  if (!hasOnDemandMetricWidgetFeature(organization)) {
    return false;
  }

  if (onDemandControlContext?.isControlEnabled) {
    return onDemandControlContext.forceOnDemand;
  }

  if (doesWidgetHaveReleaseConditions(widget)) {
    return false;
  }

  if (doesWidgetHaveDisabledOnDemand(widget)) {
    return false;
  }

  return isOnDemandMetricWidget(widget);
};
