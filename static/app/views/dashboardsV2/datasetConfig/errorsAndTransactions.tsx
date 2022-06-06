import {EventsStats, MultiSeriesEventsStats, Organization} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {DatasetConfig} from './base';

export function getErrorsAndTransactionsConfig(
  organization: Organization
): DatasetConfig<EventsStats | MultiSeriesEventsStats, TableData | EventsTableData> {
  const isAlias = !organization.features.includes(
    'discover-frontend-use-events-endpoint'
  );

  return {
    customFieldRenderer: (field, meta) => getFieldRenderer(field, meta, isAlias),
    transformSeries: (_data: EventsStats | MultiSeriesEventsStats) => {
      return [] as Series[];
    },
    transformTable: (_data: TableData | EventsTableData) => {
      return {data: []} as TableData;
    },
  };
}
