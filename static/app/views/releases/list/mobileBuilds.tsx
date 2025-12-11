import {useCallback, useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';

type Props = {
  organization: Organization;
  projectSlug: string | undefined;
};

export default function MobileBuilds({organization, projectSlug}: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery] = useQueryState('query', parseAsString);
  const [cursor] = useQueryState('cursor', parseAsString);

  const buildsQueryParams = useMemo(() => {
    const query: Record<string, any> = {
      per_page: 25,
      ...normalizeDateTimeParams(location.query),
    };

    if (cursor) {
      query.cursor = cursor;
    }

    if (searchQuery?.trim()) {
      query.query = searchQuery.trim();
    }

    return query;
  }, [cursor, location, searchQuery]);

  const {
    data: buildsData,
    isPending: isLoadingBuilds,
    error: buildsError,
    refetch,
    getResponseHeader,
  }: UseApiQueryResult<
    ListBuildsApiResponse,
    RequestError
  > = useApiQuery<ListBuildsApiResponse>(
    [
      `/projects/${organization.slug}/${projectSlug}/preprodartifacts/list-builds/`,
      {query: buildsQueryParams},
    ],
    {
      staleTime: 0,
      enabled: !!projectSlug,
    }
  );

  const handleSearch = useCallback(
    (query: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, query},
      });
    },
    [location, navigate]
  );

  if (!projectSlug) {
    return <LoadingIndicator />;
  }

  const builds = buildsData?.builds ?? [];
  const pageLinks = getResponseHeader?.('Link') ?? undefined;
  const hasSearchQuery = !!searchQuery?.trim();
  const shouldShowSearchBar = builds.length > 0 || hasSearchQuery;

  return (
    <Stack gap="xl">
      {shouldShowSearchBar && (
        <SearchBar
          placeholder={t('Search by build, SHA, branch name, or pull request')}
          onSearch={handleSearch}
          query={searchQuery ?? undefined}
        />
      )}

      {buildsError && <LoadingError onRetry={refetch} />}

      <PreprodBuildsTable
        builds={builds}
        isLoading={isLoadingBuilds}
        error={!!buildsError}
        pageLinks={pageLinks}
        organizationSlug={organization.slug}
        projectSlug={projectSlug}
        hasSearchQuery={hasSearchQuery}
      />
    </Stack>
  );
}
