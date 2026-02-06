import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getCountStatusSeries} from 'sentry/views/insights/sessions/utils/sessions';

export default function useUserHealthBreakdown({
  type,
  pageFilters,
}: {
  type: 'count' | 'rate';
  pageFilters?: PageFilters;
}) {
  const organization = useOrganization();
  const {selection: defaultPageFilters} = usePageFilters();

  const {
    data: userData,
    isPending,
    error,
  } = useApiQuery<SessionApiResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sessions/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...pageFiltersToQueryParams(pageFilters || defaultPageFilters),
          interval: getSessionsInterval(
            pageFilters ? pageFilters.datetime : defaultPageFilters.datetime
          ),
          field: ['count_unique(user)'],
          groupBy: ['session.status'],
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending || !userData) {
    return {
      series: [],
      isPending,
      error,
    };
  }

  // Create a map of status to their data
  const statusData = {
    crashed: getCountStatusSeries('crashed', userData.groups),
    errored: getCountStatusSeries('errored', userData.groups),
    unhandled: getCountStatusSeries('unhandled', userData.groups),
    abnormal: getCountStatusSeries('abnormal', userData.groups),
    healthy: getCountStatusSeries('healthy', userData.groups),
  };

  const createDatapoints = (data: number[]) =>
    data.map((count, idx) => {
      const intervalTotal = userData.groups.reduce(
        (acc, group) => acc + (group.series['count_unique(user)']?.[idx] ?? 0),
        0
      );

      if (type === 'count') {
        return {
          name: userData.intervals[idx] ?? '',
          value: intervalTotal > 0 ? count : 0,
        };
      }

      return {
        name: userData.intervals[idx] ?? '',
        value: intervalTotal > 0 ? count / intervalTotal : 0,
      };
    });

  const createSeries = (
    data: ReturnType<typeof createDatapoints>,
    status: keyof typeof statusData
  ) => ({
    data,
    seriesName: `${status}_user_${type}`,
    meta: {
      fields: {
        [`${status}_user_${type}`]:
          type === 'count' ? ('integer' as const) : ('percentage' as const),
        time: 'date' as const,
      },
      units: {},
    },
  });

  // Wrap all session rate data in a series
  const series = Object.entries(statusData).map(([status, data]) =>
    createSeries(createDatapoints(data), status as keyof typeof statusData)
  );

  return {
    series,
    isPending,
    error,
  };
}
