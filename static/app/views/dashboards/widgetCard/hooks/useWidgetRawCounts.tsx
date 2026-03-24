import {useMemo} from 'react';

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
  aggregate?: string;
};

export function createTraceMetricEventsFilter(traceMetrics: TraceMetric[]): string {
  const parts = traceMetrics.map(traceMetric => {
    const filters = [
      `metric.name:${traceMetric.name}`,
      `metric.type:${traceMetric.type}`,
    ];

    if (traceMetric.unit === NONE_UNIT) {
      filters.push(`( !has:metric.unit OR metric.unit:${NONE_UNIT} )`);
    } else if (traceMetric.unit) {
      filters.push(`metric.unit:${traceMetric.unit}`);
    }

    return `( ${filters.join(' ')} )`;
  });

  return parts.join(' OR ');
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
