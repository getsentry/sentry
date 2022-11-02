import {RenderProps} from 'sentry/components/charts/eventsRequest';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {defined} from 'sentry/utils';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformEventsRequestToArea<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: RenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    widgetProps.location.query
  );

  const data = results.timeseriesData ?? [];

  const childData = {
    ...results,
    isLoading: results.loading || results.reloading,
    isErrored: results.errored,
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    hasData: defined(data) && !!data.length && !!data[0].data.length,
    data,
    previousData: results.previousTimeseriesData ?? undefined,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
