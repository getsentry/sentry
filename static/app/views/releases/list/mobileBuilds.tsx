import {useCallback, useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {
  getPreprodBuildsDisplay,
  PreprodBuildsDisplay,
} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import PreprodBuildsSearchBar from 'sentry/views/preprod/components/preprodBuildsSearchBar';
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
  const hasDistributionFeature = organization.features.includes(
    'preprod-build-distribution'
  );
  const activeDisplay = useMemo(
    () => getPreprodBuildsDisplay(location.query.display, hasDistributionFeature),
    [hasDistributionFeature, location.query.display]
  );

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

  const handleDisplayChange = useCallback(
    (display: PreprodBuildsDisplay) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, display},
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
      <Flex
        align={{xs: 'stretch', sm: 'center'}}
        direction={{xs: 'column', sm: 'row'}}
        gap="md"
        wrap="wrap"
      >
        <PreprodBuildsSearchBar
          onSearch={handleSearch}
          query={searchQuery ?? undefined}
          disabled={isLoadingBuilds}
          displayOptions={
            hasDistributionFeature
              ? {selected: activeDisplay, onSelect: handleDisplayChange}
              : undefined
          }
        />
      </Flex>

      {buildsError && <LoadingError onRetry={refetch} />}

      <PreprodBuildsTable
        builds={builds}
        display={activeDisplay}
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
