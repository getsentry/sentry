import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {SizeUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import {
  transformTimeSeriesResponse,
  type WidgetTimeSeries,
} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';

function transformTimeSeries(
  data: EventsTimeSeriesResponse,
  widget: Widget,
  queryIndex: number
): WidgetTimeSeries[] {
  const isSingleUngroupedSeries =
    data.timeSeries.length === 1 && !data.timeSeries[0]!.groupBy?.length;

  const series = transformTimeSeriesResponse(data, widget, queryIndex, {
    meta: {valueType: 'size', valueUnit: SizeUnit.BYTE},
    getSeriesName: isSingleUngroupedSeries
      ? (_timeSeries, widgetQuery) =>
          widgetQuery.name ||
          widgetQuery.aggregates?.[0] ||
          widgetQuery.fields?.[0] ||
          'App Size'
      : undefined,
  });

  // Stacked bars line up by bucket index, so removing empty buckets shifts
  // grouped series onto the wrong timestamps. Empty buckets already render as
  // nothing in a bar chart.
  if (widget.displayType === DisplayType.BAR) {
    return series;
  }

  return series.map(item => ({
    ...item,
    timeSeries: {
      ...item.timeSeries,
      values: carryForwardLastBuild(item.timeSeries.values),
    },
  }));
}

/**
 * A bucket without a build is empty, but the app is still the size of its
 * last build. Lines show that size instead of dropping to zero. Buckets before
 * the first build in range stay empty.
 */
function carryForwardLastBuild(values: TimeSeriesItem[]): TimeSeriesItem[] {
  let lastValue: number | null = null;
  return values.map(item => {
    // Matches the legacy empty bucket check. No real build has a size of 0.
    if (item.value === null || item.value === 0) {
      return {...item, value: lastValue};
    }
    lastValue = item.value;
    return item;
  });
}

export const mobileAppSizeResponseTransforms: Pick<
  DatasetConfig<EventsTimeSeriesResponse, TableData>,
  'transformTable' | 'transformTimeSeries'
> = {
  transformTable: (
    data: TableData,
    _widgetQuery: WidgetQuery,
    _organization: Organization,
    _pageFilters: PageFilters
  ): TableData => {
    return data;
  },
  transformTimeSeries,
};
