import {useMemo, useState} from 'react';

import {defined} from 'sentry/utils';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MetricQueryRows} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/metricQueryRows';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {getTraceMetricAggregateSource} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {assignSequentialLabels} from 'sentry/views/explore/metrics/hooks/useStableLabels';
import {defaultMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsEquationsInDashboards} from 'sentry/views/explore/metrics/metricsFlags';
import {LocalMultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';

interface MetricsEquationVisualizeProps {
  onEquationRemoved: () => void;
}

/**
 * Parses the equation from the widget builder state and populates the metric queries
 * context with the metric queries for the equation and its subcomponents since the
 * widget builder can only support a single selected query in state at the moment for
 * rendering equations
 */
export function MetricsEquationVisualize({
  onEquationRemoved,
}: MetricsEquationVisualizeProps) {
  const organization = useOrganization();
  const hasEquations = canUseMetricsEquationsInDashboards(organization);
  const {state} = useWidgetBuilderContext();

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );
  const currentAggregate = aggregateSource?.[0]
    ? generateFieldAsString(aggregateSource[0])
    : '';

  const initialQueries = useMemo(() => {
    // If there's an equation, we can parse it to get the metric queries and equation row
    const equationField = aggregateSource?.find(f => f.kind === FieldValueKind.EQUATION);
    if (equationField) {
      const parsed = parseAggregateExpression(generateFieldAsString(equationField));
      return parsed.equationRow
        ? [
            ...parsed.metricQueries,
            {
              ...parsed.equationRow,
              queryParams: parsed.equationRow.queryParams.replace({
                query: state.query?.[0] ?? '',
              }),
            },
          ]
        : parsed.metricQueries;
    }

    // Otherwise, we parse each function to get the available metric queries and
    // add a default equation row
    const metricQueries = (aggregateSource ?? [])
      .filter(f => f.kind === FieldValueKind.FUNCTION)
      .map(f => {
        const parsed = parseAggregateExpression(generateFieldAsString(f));
        return parsed.metricQueries[0];
      })
      .filter(defined);
    if (metricQueries.length === 0) {
      metricQueries.push(defaultMetricQuery());
    }
    metricQueries.push(defaultMetricQuery({type: 'equation'}));
    return metricQueries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(() => {
    const labels = assignSequentialLabels(initialQueries);
    const matchIdx = initialQueries.findIndex(
      q => q.queryParams.visualizes[0]?.yAxis === currentAggregate
    );
    return matchIdx >= 0 ? labels[matchIdx] : labels[0];
  });

  return (
    <LocalMultiMetricsQueryParamsProvider
      initialQueries={initialQueries}
      hasEquations={hasEquations}
    >
      <MetricQueryRows
        selectedLabel={selectedLabel}
        setSelectedLabel={setSelectedLabel}
        onEquationRemoved={onEquationRemoved}
      />
    </LocalMultiMetricsQueryParamsProvider>
  );
}
