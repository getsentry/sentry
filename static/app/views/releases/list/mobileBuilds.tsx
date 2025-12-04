import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
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
  const {cursor, query: urlSearchQuery} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      query: decodeScalar,
    },
  });
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const searchInputValue = pendingSearchQuery ?? urlSearchQuery ?? '';
  const debouncedSearchInput = useDebouncedValue(searchInputValue);
  const previousUrlSearchQuery = useRef(urlSearchQuery);

  useEffect(() => {
    if (previousUrlSearchQuery.current === urlSearchQuery) {
      return;
    }

    previousUrlSearchQuery.current = urlSearchQuery;
    setPendingSearchQuery(null);
  }, [urlSearchQuery]);

  useEffect(() => {
    if (pendingSearchQuery === null) {
      return;
    }

    if (debouncedSearchInput === (urlSearchQuery ?? '')) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          query: debouncedSearchInput.trim() || undefined,
          cursor: undefined,
        },
      },
      {replace: true}
    );
  }, [debouncedSearchInput, location, navigate, pendingSearchQuery, urlSearchQuery]);

  const buildsQueryParams = useMemo(() => {
    const query: Record<string, any> = {
      per_page: 25,
      ...normalizeDateTimeParams(location.query),
    };

    if (cursor) {
      query.cursor = cursor;
    }

    const effectiveQuery = pendingSearchQuery ?? urlSearchQuery;
    if (effectiveQuery?.trim()) {
      query.query = effectiveQuery.trim();
    }

    return query;
  }, [cursor, location.query, pendingSearchQuery, urlSearchQuery]);

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

  if (!projectSlug) {
    return <LoadingIndicator />;
  }

  const builds = buildsData?.builds ?? [];
  const pageLinks = getResponseHeader?.('Link') ?? null;
  const hasSearchQuery = !!(pendingSearchQuery ?? urlSearchQuery)?.trim();
  const shouldShowSearchBar = builds.length > 0 || hasSearchQuery;

  return (
    <BuildsContent>
      {shouldShowSearchBar ? (
        <SearchBar
          placeholder={t('Search by build, SHA, branch name, or pull request')}
          onChange={setPendingSearchQuery}
          query={searchInputValue}
        />
      ) : null}
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
    </BuildsContent>
  );
}

const BuildsContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
