import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {type AutofixOverviewResponse, type OverviewSort, QUERY_STALE_TIME} from './types';

// Progressive load: the base request paints the cards fast, then the enriched
// `expand` request fills in Snuba stats and SCM details.
export function useAutofixOverview({
  organization,
  selection,
  sort,
  enabled,
}: {
  enabled: boolean;
  organization: Organization;
  selection: PageFilters;
  sort: OverviewSort;
}) {
  const overviewQuery = (query: {expand?: Array<'scmInfo' | 'issueStats'>}) =>
    apiOptions.as<AutofixOverviewResponse>()(
      '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          project: selection.projects,
          ...normalizeDateTimeParams(selection.datetime),
          // Default sort keeps the URL clean and adds no backend Snuba work.
          ...(sort === 'seer' ? {} : {sort}),
          ...query,
        },
        staleTime: QUERY_STALE_TIME,
      }
    );

  const enrichedQuery = useQuery({
    ...overviewQuery({expand: ['scmInfo', 'issueStats']}),
    enabled,
    placeholderData: keepPreviousData,
    // Enrichment is progressive polish: fail fast to empty slots rather than
    // shimmering through the default retry backoff.
    retry: 1,
  });
  // Base is a one-time bootstrap: it stops fetching once enriched has data, so a
  // filter/sort change makes a single enriched request rather than two.
  const baseQuery = useQuery({
    ...overviewQuery({}),
    enabled: enabled && !enrichedQuery.data,
    placeholderData: keepPreviousData,
  });

  const data = enrichedQuery.data ?? baseQuery.data;
  return {
    data,
    isPending: !data,
    // Error only once both fail with nothing to show; base alone may still be
    // recovered by an in-flight enriched call.
    isError: baseQuery.isError && enrichedQuery.isError && !data,
    // Cold-load shimmer only: base is painted but no enriched payload yet.
    enrichmentPending: Boolean(data) && !enrichedQuery.data && !enrichedQuery.isError,
    // A later refetch keeps the list up; the caller shows a spinner meanwhile.
    isRefetching: enrichedQuery.isFetching && Boolean(enrichedQuery.data),
    refetch: () => {
      baseQuery.refetch();
      enrichedQuery.refetch();
    },
  };
}
