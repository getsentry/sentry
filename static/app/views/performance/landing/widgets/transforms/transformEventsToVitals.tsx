import {RenderProps} from 'app/components/charts/eventsRequest';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'app/utils';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformEventsRequestToVitals<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: RenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query);

  const data = results.results ?? [];

  const childData = {
    ...results,
    isLoading: results.loading,
    isErrored: results.errored,
    hasData: defined(data) && !!data.length && !!data[0].data.length,
    data,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
