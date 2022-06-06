import {EventsStats, MultiSeriesEventsStats} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {DatasetConfig} from './base';

export const ErrorsAndTransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  // TODO: Needs to take in organization
  customFieldRenderer: (field, meta) => getFieldRenderer(field, meta, true),
  transformSeries: (_data: EventsStats | MultiSeriesEventsStats) => {
    return [] as Series[];
  },
  transformTable: (_data: TableData | EventsTableData) => {
    return {data: []} as TableData;
  },
};
