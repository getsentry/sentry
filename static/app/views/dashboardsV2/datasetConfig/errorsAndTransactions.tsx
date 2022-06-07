import {EventsStats, MultiSeriesEventsStats} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {WidgetQuery} from '../types';

import {ContextualProps, DatasetConfig} from './base';

export const ErrorsAndTransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  getCustomFieldRenderer: (field, meta, contextualProps) => {
    const isAlias = !contextualProps?.organization?.features.includes(
      'discover-frontend-use-events-endpoint'
    );
    return getFieldRenderer(field, meta, isAlias);
  },
  transformSeries: (_data: EventsStats | MultiSeriesEventsStats) => {
    return [] as Series[];
  },
  transformTable: transformEventsResponseToTable,
};

function transformEventsResponseToTable(
  data: TableData | EventsTableData,
  _widgetQuery: WidgetQuery,
  contextualProps?: ContextualProps
): TableData {
  let tableData = data;
  const shouldUseEvents =
    contextualProps?.organization?.features.includes(
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
