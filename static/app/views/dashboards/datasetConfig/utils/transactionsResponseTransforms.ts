import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';

export const transactionsResponseTransforms: Pick<
  DatasetConfig<
    EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
    TableData | EventsTableData
  >,
  'transformSeries' | 'transformTable'
> = {
  transformSeries: transformEventsResponseToSeries,
  transformTable: transformEventsResponseToTable,
};
