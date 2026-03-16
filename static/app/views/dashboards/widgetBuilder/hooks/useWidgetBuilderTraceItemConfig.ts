import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import type {TraceItemAttributeConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function useWidgetBuilderTraceItemConfig(): TraceItemAttributeConfig {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();

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
    const aggregateSource = usesTimeSeriesData(state.displayType)
      ? state.yAxis
      : state.fields;
    const traceMetric = aggregateSource?.[0]
      ? extractTraceMetricFromColumn(aggregateSource[0])
      : undefined;

    if (traceMetric) {
      return {
        traceItemType: TraceItemDataset.TRACEMETRICS,
        enabled: true,
        query: createTraceMetricFilter(traceMetric),
      };
    }
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
