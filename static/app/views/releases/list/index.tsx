import {useCallback, useEffect, useMemo} from 'react';
import {forceCheck} from 'react-lazyload';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import type {Release} from 'sentry/types/release';
import {ReleaseStatus} from 'sentry/types/release';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import Header from 'sentry/views/releases/components/header';
import ReleaseArchivedNotice from 'sentry/views/releases/detail/overview/releaseArchivedNotice';
import ReleaseHealthCTA from 'sentry/views/releases/list/releaseHealthCTA';
import ReleaseListInner from 'sentry/views/releases/list/releaseListInner';
import {isMobileRelease} from 'sentry/views/releases/utils';

import ReleasesDisplayOptions, {ReleasesDisplayOption} from './releasesDisplayOptions';
import ReleasesSortOptions from './releasesSortOptions';
import ReleasesStatusOptions, {ReleasesStatusOption} from './releasesStatusOptions';

const RELEASE_FILTER_KEYS = [
  ...Object.values(SEMVER_TAGS),
  {
    key: 'release',
    name: 'release',
  },
].reduce<TagCollection>((acc, tag) => {
  acc[tag.key] = tag;
  return acc;
}, {});

function makeReleaseListQueryKey({
  organizationSlug,
  location,
  activeSort,
  activeStatus,
}: {
  location: ReturnType<typeof useLocation>;
  organizationSlug: string;
  activeSort?: ReleasesSortOption;
  activeStatus?: ReleasesStatusOption;
}): ApiQueryKey {
  const query = {
    project: location.query.project,
    environment: location.query.environment,
    cursor: location.query.cursor,
    query: location.query.query,
    sort: location.query.sort,
    summaryStatsPeriod: location.query.statsPeriod,
    per_page: 20,
    flatten: activeSort === ReleasesSortOption.DATE ? 0 : 1,
    adoptionStages: 1,
    status:
      activeStatus === ReleasesStatusOption.ARCHIVED
        ? ReleaseStatus.ARCHIVED
        : ReleaseStatus.ACTIVE,
  };

  return [`/organizations/${organizationSlug}/releases/`, {query}];
}

export default function ReleasesList() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const location = useLocation();
  const navigate = useNavigate();

  const activeQuery = useMemo(() => {
    const {query: locationQuery} = location.query;
    return typeof locationQuery === 'string' ? locationQuery : '';
  }, [location.query]);

  const activeSort = useMemo(() => {
    const {sort: locationSort} = location.query;

    // Require 1 environment for date adopted
    if (
      locationSort === ReleasesSortOption.ADOPTION &&
      selection.environments.length !== 1
    ) {
      return ReleasesSortOption.DATE;
    }

    const sortExists = Object.values(ReleasesSortOption).includes(
      locationSort as ReleasesSortOption
    );
    if (sortExists) {
      return locationSort as ReleasesSortOption;
    }

    return ReleasesSortOption.DATE;
  }, [selection.environments, location.query]);

  const activeDisplay = useMemo(() => {
    const {display: locationDisplay} = location.query;

    switch (locationDisplay) {
      case ReleasesDisplayOption.USERS:
        return ReleasesDisplayOption.USERS;
      default:
        return ReleasesDisplayOption.SESSIONS;
    }
  }, [location.query]);

  const activeStatus = useMemo(() => {
    const {status} = location.query;

    switch (status) {
      case ReleasesStatusOption.ARCHIVED:
        return ReleasesStatusOption.ARCHIVED;
      default:
        return ReleasesStatusOption.ACTIVE;
    }
  }, [location.query]);

  const {
    data: releases = [],
    isPending: isReleasesPending,
    isRefetching: isReleasesRefetching,
    error: releasesError,
    getResponseHeader: getReleasesResponseHeader,
  } = useApiQuery<Release[]>(
    makeReleaseListQueryKey({
      organizationSlug: organization.slug,
      location,
      activeSort,
      activeStatus,
    }),
    {staleTime: Infinity, placeholderData: prev => prev}
  );

  useEffect(() => {
    /**
     * Manually trigger checking for elements in viewport.
     * Helpful when LazyLoad components enter the viewport without resize or scroll events,
     * https://github.com/twobin/react-lazyload#forcecheck
     *
     * HealthStatsCharts are being rendered only when they are scrolled into viewport.
     * This is how we re-check them without scrolling once releases change.
     */
    forceCheck();
  }, [releases]);

  const selectedProject = useMemo(() => {
    // Return the first project when 'All Projects' is displayed.
    // This ensures the onboarding panel is shown correctly, for example.
    if (selection.projects.length === 0) {
      return projects[0];
    }

    const selectedProjectId =
      selection.projects && selection.projects.length === 1 && selection.projects[0];
    return projects?.find(p => p.id === `${selectedProjectId}`);
  }, [selection.projects, projects]);

  const handleSearch = useCallback(
    (query: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, query},
      });
    },
    [location, navigate]
  );

  const handleSortBy = useCallback(
    (sort: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, sort},
      });
    },
    [location, navigate]
  );

  const handleDisplay = useCallback(
    (display: string) => {
      let sort = location.query.sort;
      if (
        sort === ReleasesSortOption.USERS_24_HOURS &&
        display === ReleasesDisplayOption.SESSIONS
      ) {
        sort = ReleasesSortOption.SESSIONS_24_HOURS;
      } else if (
        sort === ReleasesSortOption.SESSIONS_24_HOURS &&
        display === ReleasesDisplayOption.USERS
      ) {
        sort = ReleasesSortOption.USERS_24_HOURS;
      } else if (
        sort === ReleasesSortOption.CRASH_FREE_USERS &&
        display === ReleasesDisplayOption.SESSIONS
      ) {
        sort = ReleasesSortOption.CRASH_FREE_SESSIONS;
      } else if (
        sort === ReleasesSortOption.CRASH_FREE_SESSIONS &&
        display === ReleasesDisplayOption.USERS
      ) {
        sort = ReleasesSortOption.CRASH_FREE_USERS;
      }

      navigate({
        ...location,
        query: {...location.query, cursor: undefined, display, sort},
      });
    },
    [location, navigate]
  );

  const handleStatus = useCallback(
    (status: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, status},
      });
    },
    [location, navigate]
  );

  const tagValueLoader = useCallback(
    (key: string, search: string) => {
      const {project} = location.query;

      // Coerce the url param into an array
      const projectIds = Array.isArray(project)
        ? project
        : typeof project === 'string'
          ? [project]
          : [];

      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: key,
        search,
        projectIds,
        endpointParams: normalizeDateTimeParams(location.query),
      });
    },
    [api, location, organization]
  );

  const getTagValues = useCallback(
    async (tag: Tag, currentQuery: string): Promise<string[]> => {
      const values = await tagValueLoader(tag.key, currentQuery);
      return values.map(({value}) => value);
    },
    [tagValueLoader]
  );

  const hasAnyMobileProject = selection.projects
    .map(id => `${id}`)
    .map(ProjectsStore.getById)
    .some(project => project?.platform && isMobileRelease(project.platform));
  const showReleaseAdoptionStages =
    hasAnyMobileProject && selection.environments.length === 1;
  const shouldShowQuickstart = Boolean(
    selectedProject &&
      // Has not set up releases
      !selectedProject?.features.includes('releases') &&
      // Has no releases
      !releases?.length
  );
  const releasesPageLinks = getReleasesResponseHeader?.('Link');

  const releasesErrorMessage = useMemo(() => {
    if (!releasesError) {
      return null;
    }
    if (releasesError?.status === 400) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(releasesError?.responseJSON?.detail);
    }
    return t('There was an error loading releases');
  }, [releasesError]);

  return (
    <PageFiltersContainer showAbsolute={false} defaultSelection={selection}>
      <SentryDocumentTitle title={t('Releases')} orgSlug={organization.slug} />
      <NoProjectMessage organization={organization}>
        <Header />
        <Layout.Body>
          <Layout.Main fullWidth>
            <ReleaseHealthCTA
              organization={organization}
              releases={releases}
              selectedProject={selectedProject}
              selection={selection}
            />
            <ReleasesPageFilterBar condensed>
              <DemoTourElement
                id={DemoTourStep.RELEASES_COMPARE}
                title={t('Compare releases')}
                description={t(
                  'Click here and select the "react" project to see how the release is trending compared to previous releases.'
                )}
                position="bottom-start"
              >
                <ProjectPageFilter />
              </DemoTourElement>
              <EnvironmentPageFilter />
              <DatePageFilter
                disallowArbitraryRelativeRanges
                menuFooterMessage={t(
                  'Changing this date range will recalculate the release metrics.'
                )}
              />
            </ReleasesPageFilterBar>

            {shouldShowQuickstart ? null : (
              <SortAndFilterWrapper>
                <StyledSearchQueryBuilder
                  searchOnChange={organization.features.includes('ui-search-on-change')}
                  onSearch={handleSearch}
                  initialQuery={activeQuery}
                  filterKeys={RELEASE_FILTER_KEYS}
                  getTagValues={getTagValues}
                  placeholder={t('Search by version, build, package, or stage')}
                  searchSource="releases"
                  showUnsubmittedIndicator
                />
                <ReleasesStatusOptions selected={activeStatus} onSelect={handleStatus} />
                <ReleasesSortOptions
                  selected={activeSort}
                  selectedDisplay={activeDisplay}
                  onSelect={handleSortBy}
                  environments={selection.environments}
                />
                <ReleasesDisplayOptions
                  selected={activeDisplay}
                  onSelect={handleDisplay}
                />
              </SortAndFilterWrapper>
            )}

            {!(isReleasesPending || isReleasesRefetching) &&
              activeStatus === ReleasesStatusOption.ARCHIVED &&
              !!releases?.length && <ReleaseArchivedNotice multi />}

            {releasesErrorMessage ? (
              <LoadingError message={releasesErrorMessage} />
            ) : (
              <ReleaseListInner
                activeDisplay={activeDisplay}
                loading={isReleasesPending}
                organization={organization}
                releases={releases}
                releasesPageLinks={releasesPageLinks}
                reloading={isReleasesRefetching}
                selectedProject={selectedProject}
                selection={selection}
                shouldShowQuickstart={shouldShowQuickstart}
                showReleaseAdoptionStages={showReleaseAdoptionStages}
              />
            )}
            <FloatingFeedbackWidget />
          </Layout.Main>
        </Layout.Body>
      </NoProjectMessage>
    </PageFiltersContainer>
  );
}

const ReleasesPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

const SortAndFilterWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr repeat(3, max-content);
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(3, 1fr);
    & > div {
      width: auto;
    }
  }
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledSearchQueryBuilder = styled(SearchQueryBuilder)`
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-column: 1 / -1;
  }
`;
