import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/useWidgetBuilderContext';
import {
  extractTraceMetricFromColumn,
  getTraceMetricAggregates,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {hasMultipleMetricsSelected} from 'sentry/views/dashboards/widgetBuilder/utils/hasMultipleMetricsSelected';
import type {TraceItemAttributeConfig} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {useTraceMetricFilter} from 'sentry/views/explore/metrics/hooks/useTraceMetricFilter';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function useWidgetBuilderTraceItemConfig(): TraceItemAttributeConfig {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();
  const traceMetrics =
    state.dataset === WidgetType.TRACEMETRICS
      ? (getTraceMetricAggregates(state.displayType, state.yAxis, state.fields)
          ?.map(extractTraceMetricFromColumn)
          .filter(defined) ?? [])
      : [];
  const traceMetricFilter = useTraceMetricFilter(traceMetrics[0]);

  if (state.dataset === WidgetType.SPANS) {
    return {
      traceItemType: TraceItemDataset.SPANS,
      enabled: organization.features.includes('visibility-explore-view'),
    };
  }

  if (state.dataset === WidgetType.LOGS) {
    return {traceItemType: TraceItemDataset.LOGS, enabled: isLogsEnabled(organization)};
  }

  if (state.dataset === WidgetType.TRACEMETRICS) {
    const hasMultipleMetrics = hasMultipleMetricsSelected(traceMetrics);

    return {
      traceItemType: TraceItemDataset.TRACEMETRICS,
      enabled: traceMetrics.length > 0 && defined(traceMetrics?.[0]?.name),
      query: hasMultipleMetrics ? undefined : traceMetricFilter,
    };
  }

  if (state.dataset === WidgetType.PREPROD_APP_SIZE) {
    return {traceItemType: TraceItemDataset.PREPROD, enabled: true};
  }

  return {traceItemType: TraceItemDataset.SPANS, enabled: false};
}
