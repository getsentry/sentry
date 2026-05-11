import {useEffect, useState} from 'react';

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

  useEffect(() => {
    if (!canUseMetricsEquationsInDashboards(organization)) {
      return;
    }

    const aggregateSource = getTraceMetricAggregateSource(
      state.displayType,
      state.yAxis,
      state.fields
    );
    if (
      state.dataset === WidgetType.TRACEMETRICS &&
      (aggregateSource ?? []).some(f => f.kind === FieldValueKind.EQUATION)
    ) {
      setIsEquationMode(true);
    } else if (isEquationMode) {
      // Turn off equation mode when changing to a non-tracemetrics dataset
      // to ensure the filter bar is shown
      setIsEquationMode(false);
    }
    // We only run this effect when the dataset changes to tracemetrics to
    // detect if we show the tracemetrics equations UI when restoring dataset state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dataset]);

  return [isEquationMode, setIsEquationMode];
}
