import {useCallback, useEffect, useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {
  getPreprodBuildsDisplay,
  PreprodBuildsDisplay,
} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodBuildsSearchControls} from 'sentry/components/preprod/preprodBuildsSearchControls';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import {PreprodOnboardingPanel} from 'sentry/components/preprod/preprodOnboardingPanel';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {usePreprodBuildsAnalytics} from 'sentry/views/preprod/hooks/usePreprodBuildsAnalytics';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

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
  }: UseApiQueryResult<BuildDetailsApiResponse[], RequestError> = useApiQuery<
    BuildDetailsApiResponse[]
  >(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/builds/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
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

  const builds = buildsData ?? [];
  const pageLinks = getResponseHeader?.('Link') ?? undefined;
  const hasSearchQuery = !!searchQuery?.trim();
  const showProjectColumn = selectedProjectIds.length > 1;
  const projectId = selectedProjectIds[0];
  const shouldShowOnboarding =
    builds.length === 0 &&
    !isLoadingBuilds &&
    !buildsError &&
    !hasSearchQuery &&
    selectedProjectIds.length === 1;

  const project = ProjectsStore.getById(projectId ?? '');
  const platform = project?.platform;

  usePreprodBuildsAnalytics({
    builds,
    cursor,
    display: activeDisplay,
    enabled: selectedProjectIds.length > 0,
    error: !!buildsError,
    isLoading: isLoadingBuilds,
    pageSource: 'releases_mobile_builds_tab',
    projectCount: selectedProjectIds.length,
    searchQuery,
  });

  useEffect(() => {
    if (shouldShowOnboarding && project && projectId) {
      trackAnalytics('preprod.builds.onboarding.viewed', {
        organization,
        platform,
        project_id: projectId,
      });
    }
  }, [shouldShowOnboarding, project, projectId, organization, platform]);

  const handleDocsClick = useCallback(
    (linkType: 'product' | 'ios' | 'android' | 'flutter' | 'react-native') => {
      trackAnalytics('preprod.builds.onboarding.docs_clicked', {
        organization,
        link_type: linkType,
        platform,
      });
    },
    [organization, platform]
  );

  if (selectedProjectIds.length === 0) {
    return <LoadingIndicator />;
  }

  return (
    <Stack gap="xl">
      <PreprodBuildsSearchControls
        initialQuery={searchQuery ?? ''}
        display={activeDisplay}
        projects={selectedProjectIds.map(Number)}
        onSearch={handleSearch}
        onDisplayChange={handleDisplayChange}
      />

      {buildsError && <LoadingError onRetry={refetch} />}

      {shouldShowOnboarding && projectId ? (
        <PreprodOnboardingPanel
          platform={platform ?? null}
          onDocsClick={handleDocsClick}
        />
      ) : (
        <PreprodBuildsTable
          builds={builds}
          display={activeDisplay}
          isLoading={isLoadingBuilds}
          error={buildsError}
          pageLinks={pageLinks}
          organizationSlug={organization.slug}
          hasSearchQuery={hasSearchQuery}
          showProjectColumn={showProjectColumn}
        />
      )}
    </Stack>
  );
}
