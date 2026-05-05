import {useMemo} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';

import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useRepositoriesById() {
  const organization = useOrganization();
  const result = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({organization, query: {per_page: 100}}),
    select: selectUniqueRepos,
  });
  useFetchAllPages({result});

  const {data} = result;

  return useMemo(() => new Map(data?.map(r => [r.id, r])), [data]);
}
