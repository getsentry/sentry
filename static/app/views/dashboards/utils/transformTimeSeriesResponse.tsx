import {defined} from 'sentry/utils/defined';
import type {
  EventsTimeSeriesResponse,
  IngestionMeta,
} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import type {
  TimeSeries,
  TimeSeriesMeta,
} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesName';

export type WidgetTimeSeries = {
  queryIndex: number;
  seriesName: string;
  timeSeries: TimeSeries;
  widgetQuery: WidgetQuery;
};

type Options = {
  getSeriesName?: (timeSeries: TimeSeries, widgetQuery: WidgetQuery) => string;
  meta?: Partial<Pick<TimeSeriesMeta, 'valueType' | 'valueUnit'>>;
};

export function transformTimeSeriesResponse(
  response: Pick<EventsTimeSeriesResponse, 'timeSeries'>,
  widget: Widget,
  queryIndex: number,
  {getSeriesName, meta}: Options = {}
): WidgetTimeSeries[] {
  const widgetQuery = widget.queries[queryIndex];
  if (!widgetQuery) {
    return [];
  }

  const queryPrefix = widget.queries.length > 1 ? `${queryIndex} : ` : '';

  return response.timeSeries
    .toSorted((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
    .map(timeSeries => {
      const seriesName = getSeriesName
        ? getSeriesName(timeSeries, widgetQuery)
        : formatTimeSeriesName(timeSeries);

      return {
        queryIndex,
        widgetQuery,
        seriesName: `${queryPrefix}${seriesName}`,
        timeSeries: {...timeSeries, meta: {...timeSeries.meta, ...meta}},
      };
    });
}

/**
 * Widgets can contain multiple queries, each one receiving ingestion metadata
 * independently per request. This function compares all ingestion metadata from
 * each result and conservatively returns the meta with the earliest `completeThrough`.
 */
export function combineIngestionMeta(
  responses: Array<EventsTimeSeriesResponse | undefined>
): IngestionMeta | undefined {
  const metas = responses.map(response => response?.meta?.ingestion).filter(defined);
  return metas.toSorted(
    (a, b) => (a.completeThrough ?? Infinity) - (b.completeThrough ?? Infinity)
  )[0];
}
