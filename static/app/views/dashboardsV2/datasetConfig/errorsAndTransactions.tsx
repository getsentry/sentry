import {EventsStats, MultiSeriesEventsStats} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';

import {DatasetConfig} from './base';

export const ErrorsAndTransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  transformSeries: (_data: EventsStats | MultiSeriesEventsStats) => {
    return [] as Series[];
  },
  transformTable: (_data: TableData | EventsTableData) => {
    return {data: []} as TableData;
  },
};
