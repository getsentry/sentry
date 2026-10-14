import {
  SERIES_NAME_PART_DELIMITER,
  SERIES_QUERY_DELIMITER,
} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import type {
  TimeSeries,
  TimeSeriesGroupBy,
  TimeSeriesMeta,
} from 'sentry/views/dashboards/widgets/common/types';

const OTHER_SERIES_NAME = 'Other';

export type WidgetTimeSeries = {
  queryIndex: number;
  seriesName: string;
  timeSeries: TimeSeries;
  widgetQuery: WidgetQuery;
};

type Options = {
  meta?: Partial<Pick<TimeSeriesMeta, 'valueType' | 'valueUnit'>>;
};

/** @public */
export function transformTimeSeriesResponse(
  response: EventsTimeSeriesResponse,
  widget: Widget,
  queryIndex: number,
  {meta}: Options = {}
): WidgetTimeSeries[] {
  const widgetQuery = widget.queries[queryIndex];
  if (!widgetQuery) {
    return [];
  }

  const hasMultipleYAxes = new Set(response.timeSeries.map(({yAxis}) => yAxis)).size > 1;
  const isGroupedQuery = widgetQuery.columns.length > 0;
  const queryPrefix = getSeriesQueryPrefix(widgetQuery, widget);

  return response.timeSeries
    .toSorted((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
    .map(timeSeries => {
      const seriesName = getLegacySeriesName(
        timeSeries,
        widgetQuery.name,
        hasMultipleYAxes,
        isGroupedQuery
      );

      return {
        queryIndex,
        widgetQuery,
        seriesName: queryPrefix
          ? `${queryPrefix}${SERIES_QUERY_DELIMITER}${seriesName}`
          : seriesName,
        timeSeries: {...timeSeries, meta: {...timeSeries.meta, ...meta}},
      };
    });
}

/**
 * Mirrors how series names are constructed in `/events-stats/`
 */
export function getLegacySeriesName(
  timeSeries: TimeSeries,
  alias: string | undefined,
  hasMultipleYAxes: boolean,
  isGroupedQuery: boolean
): string {
  const {yAxis} = timeSeries;
  const hasGroupBy = timeSeries.meta.isOther || (timeSeries.groupBy?.length ?? 0) > 0;
  // A grouped query with no groups and multiple y-axes is keyed under an empty group name
  const isGrouped = hasGroupBy || (isGroupedQuery && hasMultipleYAxes);

  if (!isGrouped) {
    return alias ? `${alias}${SERIES_NAME_PART_DELIMITER}${yAxis}` : yAxis;
  }

  const groupName = timeSeries.meta.isOther
    ? OTHER_SERIES_NAME
    : getLegacyGroupName(timeSeries.groupBy ?? []);

  if (!hasMultipleYAxes) {
    return alias ? `${alias}${SERIES_NAME_PART_DELIMITER}${groupName}` : groupName;
  }

  const name = `${groupName}${SERIES_NAME_PART_DELIMITER}${yAxis}`;
  return alias ? `${alias}${SERIES_QUERY_DELIMITER}${name}` : name;
}

/**
 * Mirrors how group by values are joined in `/events-stats/` result keys
 */
function getLegacyGroupName(groupBy: TimeSeriesGroupBy[]): string {
  const groupName = groupBy
    .map(({value}) => {
      if (value === null) {
        return 'None';
      }
      if (Array.isArray(value)) {
        return `[${value.map(item => item ?? '(no value)').join(',')}]`;
      }
      if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
      }
      return String(value);
    })
    .join(',');

  // A real "Other" group would collide with the Other bucket, so append the field
  return groupName === OTHER_SERIES_NAME && groupBy[0]
    ? `${groupName} (${groupBy[0].key})`
    : groupName;
}
