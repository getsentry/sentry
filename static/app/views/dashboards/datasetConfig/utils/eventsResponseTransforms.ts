import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {isEventsTimeSeriesResponse} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import {
  getTimeSeriesResultTypes,
  getTimeSeriesResultUnits,
  transformTimeSeriesResponseToSeries,
} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';

export const EventsResponseTransforms: Pick<
  DatasetConfig<
    | EventsStats
    | MultiSeriesEventsStats
    | GroupedMultiSeriesEventsStats
    | EventsTimeSeriesResponse,
    TableData | EventsTableData
  >,
  'transformTable' | 'transformSeries' | 'getSeriesResultType' | 'getSeriesResultUnit'
> = {
  transformTable: transformEventsResponseToTable,
  transformSeries: (data, widgetQuery) =>
    isEventsTimeSeriesResponse(data)
      ? transformTimeSeriesResponseToSeries(data, widgetQuery)
      : transformEventsResponseToSeries(data, widgetQuery),
  getSeriesResultType: data =>
    isEventsTimeSeriesResponse(data) ? getTimeSeriesResultTypes(data) : {},
  getSeriesResultUnit: data =>
    isEventsTimeSeriesResponse(data) ? getTimeSeriesResultUnits(data) : {},
};
