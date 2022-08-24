import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {defined} from 'sentry/utils';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {GenericChildrenProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

/**
 * Cleans up lists to remove 'null' transactions rows from metrics-backed data.
 */
function removeEmptyTransactionsFromList(data: TableDataRow[]) {
  const transactionColumnExists = data.some(
    d => typeof d === 'object' && 'transaction' in d
  );
  return transactionColumnExists
    ? data.filter(d =>
        typeof d === 'object' && 'transaction' in d ? d.transaction : true
      )
    : data;
}

export function transformDiscoverToList<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: GenericChildrenProps<TableData>,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    widgetProps.location.query,
    {
      defaultStatsPeriod: DEFAULT_STATS_PERIOD,
    }
  );

  const _data = results.tableData?.data ?? [];
  const data = removeEmptyTransactionsFromList(_data);

  const childData = {
    ...results,
    isErrored: !!results.error,
    hasData: defined(data) && !!data.length,
    data,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
