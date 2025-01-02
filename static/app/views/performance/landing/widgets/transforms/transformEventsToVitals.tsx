import type {RenderProps} from 'sentry/components/charts/eventsRequest';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {defined} from 'sentry/utils';

import type {
  QueryDefinitionWithKey,
  WidgetDataConstraint,
  WidgetPropUnion,
} from '../types';

export function transformEventsRequestToVitals<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: RenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    widgetProps.location.query
  );

  const data = results.results ?? results.timeseriesData ?? [];

  const childData = {
    ...results,
    isLoading: results.loading || results.reloading,
    isErrored: results.errored,
    hasData: defined(data) && !!data.length && !!data[0]!.data.length,
    data,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
