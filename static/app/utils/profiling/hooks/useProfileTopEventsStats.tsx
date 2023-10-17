import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {EventsStatsSeries, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {transformSingleSeries} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseProfileTopEventsStatsOptions<F> {
  dataset: 'profileFunctions';
  fields: string[];
  others: boolean;
  referrer: string;
  topEvents: number;
  yAxes: readonly F[];
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  interval?: string;
  query?: string;
}

export function useProfileTopEventsStats<F extends string>({
  dataset,
  datetime,
  fields,
  interval,
  others,
  query,
  referrer,
  topEvents,
  yAxes,
  enabled = true,
}: UseProfileTopEventsStatsOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/events-stats/`;
  const endpointOptions = {
    query: {
      dataset,
      field: fields,
      referrer,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(datetime ?? selection.datetime),
      yAxis: yAxes,
      interval,
      query,
      topEvents,
      excludeOther: others ? '0' : '1',
    },
  };

  const {data, ...rest} = useApiQuery<any>([path, endpointOptions], {
    staleTime: Infinity,
    enabled,
  });

  const transformed = useMemo(
    () => data && transformTopEventsStatsResponse(dataset, yAxes, data),
    [yAxes, data, dataset]
  );

  return {
    data: transformed,
    ...rest,
  };
}

function transformTopEventsStatsResponse<F extends string>(
  dataset: 'profileFunctions',
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

  const data: EventsStatsSeries<F>['data'] = [];
  let meta: EventsStatsSeries<F>['meta'] = {
    dataset,
    end: -1,
    start: -1,
  };
  let timestamps: EventsStatsSeries<F>['timestamps'] = [];

  let firstSeries = true;

  for (const label of Object.keys(rawData)) {
    for (const yAxis of yAxes) {
      let dataForYAxis = rawData[label];
      if (yAxes.length > 1) {
        dataForYAxis = dataForYAxis[yAxis];
      }
      if (!defined(dataForYAxis)) {
        continue;
      }

      const transformed = transformSingleSeries(dataset, yAxis, dataForYAxis, label);

      if (firstSeries) {
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

      firstSeries = false;
    }
  }

  return {
    data,
    meta,
    timestamps,
  };
}
