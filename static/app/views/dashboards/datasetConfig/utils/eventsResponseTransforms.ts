import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {
  getTimeSeriesResultTypes,
  getTimeSeriesResultUnits,
} from 'sentry/views/dashboards/utils/getTimeSeriesResultMeta';
import {isEventsTimeSeriesResponse} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformTimeSeriesResponse} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';

export const eventsResponseTransforms: Pick<
  DatasetConfig<
    | EventsStats
    | MultiSeriesEventsStats
    | GroupedMultiSeriesEventsStats
    | EventsTimeSeriesResponse,
    TableData | EventsTableData
  >,
  'transformTable' | 'transformTimeSeries' | 'getSeriesResultType' | 'getSeriesResultUnit'
> = {
  transformTable: transformEventsResponseToTable,
  transformTimeSeries: transformTimeSeriesResponse,
  getSeriesResultType: data =>
    isEventsTimeSeriesResponse(data) ? getTimeSeriesResultTypes(data) : {},
  getSeriesResultUnit: data =>
    isEventsTimeSeriesResponse(data) ? getTimeSeriesResultUnits(data) : {},
};
