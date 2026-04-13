import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useTraceMetricMultiMetricSelection} from 'sentry/views/dashboards/widgetBuilder/hooks/useTraceMetricMultiMetricSelection';
import {
  extractTraceMetricFromColumn,
  getTraceMetricAggregateSource,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {hasMultipleMetricsSelected} from 'sentry/views/dashboards/widgetBuilder/utils/hasMultipleMetricsSelected';
import type {TraceItemAttributeConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function useWidgetBuilderTraceItemConfig(): TraceItemAttributeConfig {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();
  const hasMultiMetricSelection = useTraceMetricMultiMetricSelection();

  if (state.dataset === WidgetType.SPANS) {
    return {
      traceItemType: TraceItemDataset.SPANS,
      enabled: organization.features.includes('visibility-explore-view'),
    };
  }

  if (state.dataset === WidgetType.LOGS) {
    return {
      traceItemType: TraceItemDataset.LOGS,
      enabled: isLogsEnabled(organization),
    };
  }

  if (state.dataset === WidgetType.TRACEMETRICS) {
    const aggregateSource = getTraceMetricAggregateSource(
      state.displayType,
      state.yAxis,
      state.fields
    );
    const traceMetrics =
      aggregateSource?.map(extractTraceMetricFromColumn).filter(defined) ?? [];
    const hasMultipleMetrics = hasMultipleMetricsSelected(
      traceMetrics,
      hasMultiMetricSelection
    );

    return {
      traceItemType: TraceItemDataset.TRACEMETRICS,
      enabled: traceMetrics.length > 0 && defined(traceMetrics?.[0]?.name),
      query:
        !hasMultipleMetrics && traceMetrics[0]
          ? createTraceMetricFilter(traceMetrics[0])
          : undefined,
    };
  }

  if (state.dataset === WidgetType.PREPROD_APP_SIZE) {
    return {
      traceItemType: TraceItemDataset.PREPROD,
      enabled: true,
    };
  }

  return {
    traceItemType: TraceItemDataset.SPANS,
    enabled: false,
  };
}
