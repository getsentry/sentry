import {useEffect} from 'react';
import {skipToken, useInfiniteQuery} from '@tanstack/react-query';

import type {RawFlagData} from 'sentry/components/featureFlags/utils';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface Params {
  organization: Organization;
  query: Record<string, unknown>;
}

export function organizationFlagLogOptions({organization, query}: Params) {
  // Don't make the request if start = end. The backend returns 400 but we prefer an empty response.
  const enabled = !query.start || !query.end || query.start !== query.end;

  return apiOptions.as<RawFlagData>()(
    '/organizations/$organizationIdOrSlug/flags/logs/',
    {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query,
      staleTime: 0,
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
}: InfiniteParams & {enabled?: boolean}) {
  // Don't make the request if start = end. The backend returns 400 but we prefer an empty response.
  const enabled =
    (!query.start || !query.end || query.start !== query.end) && enabledParam;

  const {
    data: infiniteData,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isPending,
    isError,
    error,
  } = useInfiniteQuery({
    ...apiOptions.asInfinite<RawFlagData>()(
      '/organizations/$organizationIdOrSlug/flags/logs/',
      {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query,
        staleTime: 0,
      }
    ),
  });

  const currentNumberPages = infiniteData?.pages.length ?? 0;

  useEffect(() => {
    if (!isFetching && hasNextPage && currentNumberPages + 1 < maxPages) {
      fetchNextPage();
    }
  }, [isFetching, hasNextPage, fetchNextPage, maxPages, currentNumberPages]);

  return {
    data: infiniteData?.pages.flatMap(page => page.json.data),
    isPending,
    isError,
    error,
  };
}
