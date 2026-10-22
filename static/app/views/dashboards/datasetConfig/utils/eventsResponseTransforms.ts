import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {
  getTimeSeriesResultTypes,
  getTimeSeriesResultUnits,
} from 'sentry/views/dashboards/utils/getTimeSeriesResultMeta';
import {transformTimeSeriesResponse} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';

export const eventsResponseTransforms: Pick<
  DatasetConfig<EventsTimeSeriesResponse, TableData | EventsTableData>,
  'transformTable' | 'transformTimeSeries' | 'getSeriesResultType' | 'getSeriesResultUnit'
> = {
  transformTable: transformEventsResponseToTable,
  transformTimeSeries: transformTimeSeriesResponse,
  getSeriesResultType: getTimeSeriesResultTypes,
  getSeriesResultUnit: getTimeSeriesResultUnits,
};
