import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
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
          enabled: isSupportedDisplayType,
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
