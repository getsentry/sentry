import {useState} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {getTraceMetricAggregateSource} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {canUseMetricsEquationsInDashboards} from 'sentry/views/explore/metrics/metricsFlags';

export function useIsEquationMode(): [boolean, (next: boolean) => void] {
  const organization = useOrganization();
  const {state} = useWidgetBuilderContext();

  const [isEquationMode, setIsEquationMode] = useState(() => {
    if (state.dataset !== WidgetType.TRACEMETRICS) {
      return false;
    }
    if (!canUseMetricsEquationsInDashboards(organization)) {
      return false;
    }

    const aggregateSource = getTraceMetricAggregateSource(
      state.displayType,
      state.yAxis,
      state.fields
    );

    return (aggregateSource ?? []).some(f => f.kind === FieldValueKind.EQUATION);
  });

  return [isEquationMode, setIsEquationMode];
}
