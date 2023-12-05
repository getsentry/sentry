import {ReactNode, useCallback, useState} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import SwitchButton from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {FlexContainer} from 'sentry/utils/discover/styles';
import {AggregationKey} from 'sentry/utils/fields';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {Widget, WidgetType} from 'sentry/views/dashboards/types';

export interface OnDemandControlContext {
  setForceOnDemand: (value: boolean) => void;
  forceOnDemand?: boolean;
  isControlEnabled?: boolean;
}

const [_OnDemandControlProvider, _useOnDemandControl, _context] =
  createDefinedContext<OnDemandControlContext>({
    name: 'OnDemandControlContext',
    strict: false,
  });

export const OnDemandControlConsumer = _context.Consumer;
export const useOnDemandControl = _useOnDemandControl;

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
  const [isControlEnabled, setIsControlEnabled] = useState(_forceOnDemand !== undefined);
  const [forceOnDemand, _setForceOnDemand] = useState(_forceOnDemand || false);

  const setForceOnDemand = useCallback(
    (value: boolean) => {
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          forceOnDemand: value,
        },
      });
      _setForceOnDemand(value);
      setIsControlEnabled(true);
    },
    [setIsControlEnabled, _setForceOnDemand, location]
  );

  return (
    <_OnDemandControlProvider value={{setForceOnDemand, isControlEnabled, forceOnDemand}}>
      {children}
    </_OnDemandControlProvider>
  );
}
/**
 * We determine that a widget is an on-demand metric widget if the widget
 * 1. type is discover
 * 2. contains no grouping
 * 3. contains only one query condition
 * 4. contains only one aggregate and does not contain unsupported aggregates
 * 5. contains one of the keys that are not supported by the standard metrics.
 */
export function _isOnDemandMetricWidget(widget: Widget): boolean {
  if (widget.widgetType !== WidgetType.DISCOVER) {
    return false;
  }

  // currently we only support widgets without grouping
  const columns = widget.queries.flatMap(query => query.columns);

  if (columns.length > 0) {
    return false;
  }

  const conditions = widget.queries.flatMap(query => query.conditions);

  const hasNonStandardConditions = conditions.some(condition =>
    isOnDemandQueryString(condition)
  );

  // currently we only support one query per widget for on-demand metrics
  if (conditions.length > 1 || !hasNonStandardConditions) {
    return false;
  }

  const aggregates = widget.queries.flatMap(query => query.aggregates);
  const unsupportedAggregates = [
    AggregationKey.PERCENTILE,
    AggregationKey.APDEX,
    AggregationKey.FAILURE_RATE,
  ];

  // check if any of the aggregates contains unsupported aggregates as substr
  const hasUnsupportedAggregates = aggregates.some(aggregate =>
    unsupportedAggregates.some(agg => aggregate.includes(agg))
  );

  // currently we only support one aggregate per widget for on-demand metrics
  return aggregates.length > 1 || !hasUnsupportedAggregates;
}

export const shouldUseOnDemandMetrics = (
  organization: Organization,
  widget: Widget,
  onDemandControlContext?: OnDemandControlContext
) => {
  if (!hasOnDemandMetricWidgetFeature(organization)) {
    return false;
  }

  if (onDemandControlContext && onDemandControlContext.isControlEnabled) {
    return onDemandControlContext.forceOnDemand;
  }

  return _isOnDemandMetricWidget(widget);
};

export function ToggleOnDemand() {
  const org = useOrganization();
  const onDemand = _useOnDemandControl();

  const toggle = useCallback(() => {
    onDemand.setForceOnDemand(!onDemand.forceOnDemand);
  }, [onDemand]);

  if (!onDemand) {
    return null;
  }

  if (!org.features.includes('on-demand-metrics-extraction-experimental')) {
    return null;
  }

  return (
    <FlexContainer
      style={{
        opacity: onDemand.isControlEnabled ? 1.0 : 0.5,
        gap: space(1),
      }}
    >
      {t('On-demand metrics')}
      <SwitchButton isActive={onDemand.forceOnDemand} size="sm" toggle={toggle} />
    </FlexContainer>
  );
}
