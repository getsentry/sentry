import {useEffect} from 'react';

import type {RawFlagData} from 'sentry/components/featureFlags/utils';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery, useInfiniteApiQuery} from 'sentry/utils/queryClient';

interface Params {
  organization: Organization;
  query: Record<string, any>;
  enabled?: boolean;
}

export function useOrganizationFlagLog({
  organization,
  query,
  enabled: enabledParam = true,
}: Params) {
  // Don't make the request if start = end. The backend returns 400 but we prefer an empty response.
  const enabled =
    (!query.start || !query.end || query.start !== query.end) && enabledParam;

  return useApiQuery<RawFlagData>(
    [`/organizations/${organization.slug}/flags/logs/`, {query}],
    {
      staleTime: 0,
      enabled,
    }
  );
}

interface InfiniteParams extends Params {
  maxPages?: number;
}

/**
 * This is an analog to `useReleaseStats` where we fetch all pages of data so that we can render it on `<EventGraph />`.
 */
export function useOrganizationFlagLogInfinite({
  organization,
  query,
  enabled: enabledParam = true,
  maxPages = 10,
}: InfiniteParams) {
  // Don't make the request if start = end. The backend returns 400 but we prefer an empty response.
  const enabled =
    (!query.start || !query.end || query.start !== query.end) && enabledParam;

  const apiQuery = useInfiniteApiQuery<RawFlagData>({
    queryKey: [
      'infinite' as const,
      `/organizations/${organization.slug}/flags/logs/`,
      {query},
    ],
    staleTime: 0,
    enabled,
  });

  const currentNumberPages = apiQuery.data?.pages.length ?? 0;

  useEffect(() => {
    if (
      !apiQuery.isFetching &&
      apiQuery.hasNextPage &&
      currentNumberPages + 1 < maxPages
    ) {
      apiQuery.fetchNextPage();
    }
  }, [apiQuery, maxPages, currentNumberPages]);

  return {
    ...apiQuery,
    data: apiQuery.data?.pages.flatMap(([pageData]) => pageData.data),
  };
}
