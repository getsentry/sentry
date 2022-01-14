import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {defined} from 'sentry/utils';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {GenericChildrenProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

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

  const data = results.tableData?.data ?? [];

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
