import {useMemo} from 'react';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {explodeFieldString} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {NONE_UNIT} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {useRawCounts, type RawCounts} from 'sentry/views/explore/useRawCounts';

type Props = {
  selection: PageFilters;
  widget: Widget;
};

type RawCountConfig = {
  dataset: DiscoverDatasets;
  enabled: boolean;
  supported: boolean;
};

export function createTraceMetricEventsFilter(traceMetrics: TraceMetric[]): string {
  const search = new MutableSearch('');
  traceMetrics.forEach((traceMetric, index) => {
    // Open the parentheses around this tracemetric filter
    search.addOp('(');

    search.addFilterValue('metric.name', traceMetric.name);
    search.addFilterValue('metric.type', traceMetric.type);
    const addNoneOperators = traceMetric.unit === NONE_UNIT;
    if (addNoneOperators) {
      search.addOp('(');
      search.addFilterValue('!has', 'metric.unit');
      search.addOp('OR');
    }

    search.addFilterValue('metric.unit', traceMetric.unit ?? NONE_UNIT);

    if (addNoneOperators) {
      search.addOp(')');
    }

    // Close the parentheses around this tracemetric filter
    search.addOp(')');

    // Add the OR operator between this tracemetric filter and the next one
    if (index < traceMetrics.length - 1) {
      search.addOp('OR');
    }
  });

  return search.toString();
}

export function useWidgetRawCounts({selection, widget}: Props): RawCounts | null {
  const rawCountConfig = useMemo<RawCountConfig>(() => {
    const isSupportedDisplayType =
      widget.displayType === DisplayType.LINE ||
      widget.displayType === DisplayType.AREA ||
      widget.displayType === DisplayType.BAR ||
      widget.displayType === DisplayType.TOP_N;

    switch (widget.widgetType) {
      case WidgetType.SPANS:
        return {
          supported: true,
          dataset: DiscoverDatasets.SPANS,
          enabled: isSupportedDisplayType,
        };
      case WidgetType.TRACEMETRICS: {
        const traceMetrics = widget.queries?.[0]?.aggregates
          ?.map(aggregate => explodeFieldString(aggregate))
          ?.map(extractTraceMetricFromColumn)
          ?.filter(defined);

        if (!defined(traceMetrics) || traceMetrics.length === 0) {
          return {
            supported: true,
            dataset: DiscoverDatasets.TRACEMETRICS,
            enabled: false,
          };
        }

        return {
          supported: true,
          dataset: DiscoverDatasets.TRACEMETRICS,
          enabled: isSupportedDisplayType,
          query: createTraceMetricEventsFilter(traceMetrics),
          normalModeExtrapolated: true,
        };
      }
      case WidgetType.LOGS:
        return {
          supported: true,
          dataset: DiscoverDatasets.OURLOGS,
          enabled: isSupportedDisplayType,
        };
      default:
        return {
          supported: false,
          dataset: DiscoverDatasets.SPANS,
          enabled: false,
        };
    }
  }, [widget]);

  const rawCounts = useRawCounts({...rawCountConfig, selection});

  return rawCountConfig.supported ? rawCounts : null;
}
