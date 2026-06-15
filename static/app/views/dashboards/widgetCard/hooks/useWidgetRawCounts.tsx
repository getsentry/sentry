import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {explodeFieldString, isEquation} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {
  createTraceMetricEventsFilter,
  getEquationMetricsTotalFilter,
} from 'sentry/views/explore/metrics/utils';
import {useRawCounts, type RawCounts} from 'sentry/views/explore/useRawCounts';

type Props = {
  selection: PageFilters;
  widget: Widget;
};

type RawCountConfig = {
  dataset: DiscoverDatasets;
  enabled: boolean;
  supported: boolean;
  normalModeExtrapolated?: boolean;
  query?: string;
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
        // Process all function aggregates and equations to ensure the total count
        // query can be derived from either
        // In the current set up, we should only have one or the other being
        // processed for this raw count
        const aggregates = widget.queries?.[0]?.aggregates ?? [];
        const functionAggregates = aggregates.filter(agg => !isEquation(agg));
        const equationAggregates = aggregates.filter(agg => isEquation(agg));

        const traceMetrics = functionAggregates
          .map(aggregate => extractTraceMetricFromColumn(explodeFieldString(aggregate)))
          .filter(defined);

        const filters: string[] = [];

        if (traceMetrics.length > 0) {
          filters.push(createTraceMetricEventsFilter(traceMetrics));
        }

        for (const equation of equationAggregates) {
          const equationFilter = getEquationMetricsTotalFilter(equation);
          if (equationFilter) {
            filters.push(equationFilter);
          }
        }

        if (filters.length === 0) {
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
          query: filters.join(' OR '),
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
