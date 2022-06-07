import {EventsStats, MultiSeriesEventsStats} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';

import {WidgetQuery} from '../types';

import {ConditionalProps, DatasetConfig} from './base';

export const ErrorsAndTransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  transformSeries: (_data: EventsStats | MultiSeriesEventsStats) => {
    return [] as Series[];
  },
  transformTable: transformEventsResponseToTable,
};

function transformEventsResponseToTable(
  data: TableData | EventsTableData,
  _widgetQuery: WidgetQuery,
  conditionalProps?: ConditionalProps
): TableData {
  let tableData = data;
  const shouldUseEvents =
    conditionalProps?.organization?.features.includes(
      'discover-frontend-use-events-endpoint'
    ) || false;
  // events api uses a different response format so we need to construct tableData differently
  if (shouldUseEvents) {
    const fieldsMeta = (data as EventsTableData).meta?.fields;
    tableData = {
      ...data,
      meta: {...fieldsMeta, isMetricsData: data.meta?.isMetricsData},
    } as TableData;
  }
  return tableData as TableData;
}
