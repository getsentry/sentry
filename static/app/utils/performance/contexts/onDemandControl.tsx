import type {ReactNode} from 'react';
import {useCallback, useState} from 'react';
import type {Location} from 'history';

import {Switch} from 'sentry/components/core/switch';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {FlexContainer} from 'sentry/utils/discover/styles';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useOrganization from 'sentry/utils/useOrganization';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';

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
      <Switch checked={onDemand.forceOnDemand} size="sm" onChange={toggle} />
    </FlexContainer>
  );
}
