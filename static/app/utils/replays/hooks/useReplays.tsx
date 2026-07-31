import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Options {
  fields: string[];
  limit: number;
  projects: number[];
  query: MutableSearch;
  queryReferrer: string;
  sort: string;
  statsPeriod: string;
}

export function useReplays({
  fields,
  limit,
  projects,
  query,
  queryReferrer,
  sort,
  statsPeriod,
}: Options) {
  const organization = useOrganization();

  return useQuery(
    apiOptions.as<{data: unknown[]}>()('/organizations/$organizationIdOrSlug/replays/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        field: fields,
        per_page: limit,
        project: projects,
        sort,
        statsPeriod,
        query: query.formatString(),
        queryReferrer,
      },
      staleTime: 0,
    })
  );
}
