import type {RenderProps} from 'sentry/components/charts/eventsRequest';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {defined} from 'sentry/utils';

import type {
  QueryDefinitionWithKey,
  WidgetDataConstraint,
  WidgetPropUnion,
} from '../types';

export function transformEventsRequestToStackedArea<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: RenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    widgetProps.location.query
  );

  let data: any;
  if (Array.isArray(results.yAxis) && results.yAxis.length > 1) {
    data = results.results ?? [];
  } else {
    data = results.timeseriesData;
  }

  const childData = {
    ...results,
    isLoading: results.loading || results.reloading,
    isErrored: results.errored,
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
