import {type RefObject, useMemo, useState} from 'react';

import {defined} from 'sentry/utils/defined';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {MetricQueryRows} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/metricQueryRows';
import {prepareQueriesForEquationMode} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import type {EquationModeSnapshot} from 'sentry/views/dashboards/widgetBuilder/hooks/useTraceMetricsVisualizeModeState';
import {getTraceMetricAggregateSource} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {assignSequentialLabels} from 'sentry/views/explore/metrics/hooks/useStableLabels';
import {defaultMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {LocalMultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';

interface MetricsEquationVisualizeProps {
  /**
   * Ref kept in sync with the current equation-mode state (all metric
   * query rows + selected label) so useVisualizeModeState can restore
   * it after a mode or dataset switch.
   */
  equationSnapshot?: RefObject<EquationModeSnapshot | null>;
}

/**
 * Parses the equation from the widget builder state and populates the metric queries
 * context with the metric queries for the equation and its subcomponents since the
 * widget builder can only support a single selected query in state at the moment for
 * rendering equations
 */
export function MetricsEquationVisualize({
  equationSnapshot,
}: MetricsEquationVisualizeProps) {
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
    // Restore from a previous equation-mode session if available
    if (equationSnapshot?.current) {
      return equationSnapshot.current.queries;
    }

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
    const metricQueries = prepareQueriesForEquationMode(
      (aggregateSource ?? [])
        .filter(f => f.kind === FieldValueKind.FUNCTION)
        .map(f => {
          const parsed = parseAggregateExpression(generateFieldAsString(f));
          return parsed.metricQueries[0];
        })
        .filter(defined)
    );
    if (metricQueries.length === 0) {
      metricQueries.push(defaultMetricQuery());
    }
    metricQueries.push(defaultMetricQuery({type: 'equation'}));
    return metricQueries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(() => {
    if (equationSnapshot?.current) {
      return equationSnapshot.current.selectedLabel;
    }
    const labels = assignSequentialLabels(initialQueries);
    const matchIdx = initialQueries.findIndex(
      q => q.queryParams.visualizes[0]?.yAxis === currentAggregate
    );
    return matchIdx >= 0 ? labels[matchIdx] : labels[0];
  });

  return (
    <LocalMultiMetricsQueryParamsProvider initialQueries={initialQueries} hasEquations>
      <MetricQueryRows
        selectedLabel={selectedLabel}
        setSelectedLabel={setSelectedLabel}
        equationSnapshot={equationSnapshot}
      />
    </LocalMultiMetricsQueryParamsProvider>
  );
}
