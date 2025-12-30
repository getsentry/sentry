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
  selectedProjectIds: string[];
};

export default function MobileBuilds({organization, selectedProjectIds}: Props) {
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

    // Add project filter for multi-project endpoint
    if (selectedProjectIds.length > 0) {
      query.project = selectedProjectIds;
    }

    return query;
  }, [cursor, location, searchQuery, selectedProjectIds]);

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
      `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
      {query: buildsQueryParams},
    ],
    {
      staleTime: 0,
      enabled: selectedProjectIds.length > 0,
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

  if (selectedProjectIds.length === 0) {
    return <LoadingIndicator />;
  }

  const builds = buildsData?.builds ?? [];
  const pageLinks = getResponseHeader?.('Link') ?? undefined;
  const hasSearchQuery = !!searchQuery?.trim();
  const showProjectColumn = selectedProjectIds.length > 1;

  return (
    <Stack gap="xl">
      <SearchBar
        placeholder={t('Search by build, SHA, branch name, or pull request')}
        onSearch={handleSearch}
        query={searchQuery ?? undefined}
        disabled={isLoadingBuilds}
      />

      {buildsError && <LoadingError onRetry={refetch} />}

      <PreprodBuildsTable
        builds={builds}
        isLoading={isLoadingBuilds}
        error={!!buildsError}
        pageLinks={pageLinks}
        organizationSlug={organization.slug}
        hasSearchQuery={hasSearchQuery}
        showProjectColumn={showProjectColumn}
      />
    </Stack>
  );
}
