import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {transformTimeSeriesResponse} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';

export const eventsResponseTransforms: Pick<
  DatasetConfig<EventsTimeSeriesResponse, TableData | EventsTableData>,
  'transformTable' | 'transformTimeSeries'
> = {
  transformTable: transformEventsResponseToTable,
  transformTimeSeries: transformTimeSeriesResponse,
};
