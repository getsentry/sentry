import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {EventsStatsSeries, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {makeFormatTo} from 'sentry/utils/profiling/units/units';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseProfileEventsStatsOptions<F> {
  dataset: 'discover' | 'profiles' | 'profileFunctions';
  referrer: string;
  yAxes: readonly F[];
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  interval?: string;
  query?: string;
}

export function useProfileEventsStats<F extends string>({
  dataset,
  datetime,
  interval,
  query,
  referrer,
  yAxes,
  enabled = true,
}: UseProfileEventsStatsOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  // when using the profiles dataset and the feature flag is enabled,
  // switch over to the discover dataset under the hood
  if (
    dataset === 'profiles' &&
    organization.features.includes('profiling-using-transactions')
  ) {
    dataset = 'discover';
  }

  if (dataset === 'discover') {
    query = `has:profile.id ${query ?? ''}`;
  }

  const path = `/organizations/${organization.slug}/events-stats/`;
  const endpointOptions = {
    query: {
      dataset,
      referrer,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(datetime ?? selection.datetime),
      yAxis: yAxes,
      interval,
      query,
    },
  };

  const {data, ...rest} = useApiQuery<any>([path, endpointOptions], {
    enabled,
    staleTime: Infinity,
  });

  const transformed = useMemo(
    () => data && transformStatsResponse(dataset, yAxes, data),
    [yAxes, data, dataset]
  );

  return {
    data: transformed,
    ...rest,
  };
}

export function transformStatsResponse<F extends string>(
  dataset: 'discover' | 'profiles' | 'profileFunctions',
  yAxes: readonly F[],
  rawData: any
): EventsStatsSeries<F> {
  // the events stats endpoint has a legacy response format so here we transform it
  // into the proposed update for forward compatibility and ease of use

  if (yAxes.length === 0) {
    return {
      data: [],
      meta: {
        dataset,
        end: 0,
        start: 0,
      },
      timestamps: [],
    };
  }

  if (yAxes.length === 1) {
    const {series, meta, timestamps} = transformSingleSeries(dataset, yAxes[0], rawData);
    return {
      data: [series],
      meta,
      timestamps,
    };
  }

  const data: EventsStatsSeries<F>['data'] = [];
  let meta: EventsStatsSeries<F>['meta'] = {
    dataset,
    end: -1,
    start: -1,
  };
  let timestamps: EventsStatsSeries<F>['timestamps'] = [];

  let firstAxis = true;

  for (const yAxis of yAxes) {
    const dataForYAxis = rawData[yAxis];
    if (!defined(dataForYAxis)) {
      continue;
    }
    const transformed = transformSingleSeries(dataset, yAxis, dataForYAxis);

    if (firstAxis) {
      meta = transformed.meta;
      timestamps = transformed.timestamps;
    } else if (
      meta.start !== transformed.meta.start ||
      meta.end !== transformed.meta.end
    ) {
      throw new Error('Mismatching start/end times');
    } else if (
      timestamps.length !== transformed.timestamps.length ||
      timestamps.some((ts, i) => ts !== transformed.timestamps[i])
    ) {
      throw new Error('Mismatching timestamps');
    }

    data.push(transformed.series);

    firstAxis = false;
  }

  return {
    data,
    meta,
    timestamps,
  };
}

export function transformSingleSeries<F extends string>(
  dataset: 'discover' | 'profiles' | 'profileFunctions',
  yAxis: F,
  rawSeries: any,
  label?: string
) {
  const type =
    rawSeries.meta.fields[yAxis] ?? rawSeries.meta.fields[getAggregateAlias(yAxis)];
  const formatter =
    type === 'duration'
      ? makeFormatTo(
          rawSeries.meta.units[yAxis] ??
            rawSeries.meta.units[getAggregateAlias(yAxis)] ??
            'nanoseconds',
          'milliseconds'
        )
      : type === 'string'
      ? value => value || ''
      : value => value;

  const series: EventsStatsSeries<F>['data'][number] = {
    axis: yAxis,
    values: [],
    label,
  };
  const meta: EventsStatsSeries<F>['meta'] = {
    dataset,
    end: rawSeries.end,
    start: rawSeries.start,
  };
  const timestamps: EventsStatsSeries<F>['timestamps'] = [];

  for (let i = 0; i < rawSeries.data.length; i++) {
    const [timestamp, value] = rawSeries.data[i];
    // the api has this awkward structure for legacy reason
    series.values.push(formatter(value[0].count as number));
    timestamps.push(timestamp);
  }

  return {
    series,
    meta,
    timestamps,
  };
}
