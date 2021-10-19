import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'app/utils';
import {TableData} from 'app/utils/discover/discoverQuery';
import {GenericChildrenProps} from 'app/utils/discover/genericDiscoverQuery';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformDiscoverToList<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: GenericChildrenProps<TableData>,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query);

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
