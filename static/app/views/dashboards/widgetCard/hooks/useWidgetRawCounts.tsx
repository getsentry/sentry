import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromWidget} from 'sentry/views/dashboards/utils/extractTraceMetricFromWidget';
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

const UNSUPPORTED_WIDGET_CONFIG: RawCountConfig = {
  supported: false,
  dataset: DiscoverDatasets.SPANS,
  enabled: false,
};

export function useWidgetRawCounts({selection, widget}: Props): RawCounts | null {
  const rawCountConfig = useMemo<RawCountConfig>(() => {
    switch (widget.widgetType) {
      case WidgetType.SPANS:
        return {
          supported: true,
          dataset: DiscoverDatasets.SPANS,
          enabled: true,
        };
      case WidgetType.LOGS:
        return {
          supported: true,
          dataset: DiscoverDatasets.OURLOGS,
          enabled: true,
        };
      case WidgetType.TRACEMETRICS: {
        const traceMetric = extractTraceMetricFromWidget(widget);
        if (!traceMetric?.name || !traceMetric?.type) {
          return {
            supported: true,
            dataset: DiscoverDatasets.TRACEMETRICS,
            aggregate: 'count(value,,,-)',
            enabled: false,
          };
        }

        return {
          supported: true,
          dataset: DiscoverDatasets.TRACEMETRICS,
          aggregate: `count(value,${traceMetric.name},${traceMetric.type},${traceMetric.unit ?? '-'})`,
          enabled: true,
        };
      }
      default:
        return UNSUPPORTED_WIDGET_CONFIG;
    }
  }, [widget]);

  const rawCounts = useRawCounts({
    dataset: rawCountConfig.dataset,
    aggregate: rawCountConfig.aggregate,
    enabled: rawCountConfig.enabled,
    selection,
  });

  return rawCountConfig.supported ? rawCounts : null;
}
