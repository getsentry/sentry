import {useQuery} from '@tanstack/react-query';

import {ResponseMeta} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {EventsStatsSeries} from 'sentry/types';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {makeFormatTo} from 'sentry/utils/profiling/units/units';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseProfileEventStatsOptions<F> {
  referrer: string;
  yAxes: readonly F[];
  interval?: string;
  query?: string;
}

export function useProfileEventsStats<F extends string>({
  yAxes,
  interval,
  query,
  referrer,
}: UseProfileEventStatsOptions<F>) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  let dataset: 'profiles' | 'discover' = 'profiles';
  if (organization.features.includes('profiling-using-transactions')) {
    dataset = 'discover';
    query = `has:profile.id ${query ?? ''}`;
  }

  const path = `/organizations/${organization.slug}/events-stats/`;
  const endpointOptions = {
    query: {
      dataset,
      referrer,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
      yAxis: yAxes,
      interval,
      query,
    },
  };

  const queryKey = [path, endpointOptions];

  const queryFn = () =>
    api
      .requestPromise(path, {
        method: 'GET',
        includeAllArgs: true,
        query: endpointOptions.query,
      })
      .then(response => transformStatsResponse(yAxes, response));

  return useQuery<ApiResponse<EventsStatsSeries<F>>>({
    queryKey,
    queryFn,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

type ApiResponse<F> = [F, string | undefined, ResponseMeta | undefined];

function transformStatsResponse<F extends string>(
  yAxes: readonly F[],
  rawResponse: ApiResponse<any>
): ApiResponse<EventsStatsSeries<F>> {
  // the events stats endpoint has a legacy response format so here we transform it
  // into the proposed update for forward compatibility and ease of use

  if (yAxes.length === 0) {
    return [
      {
        data: [],
        meta: {
          dataset: 'profiles',
          end: 0,
          start: 0,
        },
        timestamps: [],
      },
      rawResponse[1],
      rawResponse[2],
    ];
  }

  if (yAxes.length === 1) {
    const {series, meta, timestamps} = transformSingleSeries(yAxes[0], rawResponse[0]);
    return [
      {
        data: [series],
        meta,
        timestamps,
      },
      rawResponse[1],
      rawResponse[2],
    ];
  }

  const data: EventsStatsSeries<F>['data'] = [];
  let meta: EventsStatsSeries<F>['meta'] = {
    dataset: 'profiles',
    end: -1,
    start: -1,
  };
  let timestamps: EventsStatsSeries<F>['timestamps'] = [];

  let firstAxis = true;

  for (const yAxis of yAxes) {
    const transformed = transformSingleSeries(yAxis, rawResponse[0][yAxis]);

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

  return [
    {
      data,
      meta,
      timestamps,
    },
    rawResponse[1],
    rawResponse[2],
  ];
}

function transformSingleSeries<F extends string>(yAxis: F, rawSeries: any) {
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
      : value => value;

  const series: EventsStatsSeries<F>['data'][number] = {
    axis: yAxis,
    values: [],
  };
  const meta: EventsStatsSeries<F>['meta'] = {
    dataset: 'profiles',
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
