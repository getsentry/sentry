import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {forceCheck} from 'react-lazyload';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {
  createSerializer,
  parseAsString,
  useQueryStates,
  type inferParserType,
} from 'nuqs';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {DocumentationHint} from 'sentry/components/documentationHint';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {TagCollection} from 'sentry/types/group';
import type {Release} from 'sentry/types/release';
import {ReleaseStatus} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import {FieldKey} from 'sentry/utils/fields';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
} from 'sentry/views/explore/components/styles';
import {ReleaseArchivedNotice} from 'sentry/views/explore/releases/detail/overview/releaseArchivedNotice';
import {isMobileRelease} from 'sentry/views/explore/releases/utils';
import {TopBar} from 'sentry/views/navigation/topBar';
import {buildDetailsApiOptions} from 'sentry/views/preprod/utils/buildDetailsApiOptions';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {
  toLLMContextProjectFields,
  useSelectedProjectsForLLMContext,
} from 'sentry/views/seerExplorer/utils/selectedProjectsForLLMContext';

import {MobileBuilds} from './mobileBuilds';
import {ReleaseHealthCTA} from './releaseHealthCTA';
import {ReleaseListInner} from './releaseListInner';
import {ReleasesDisplayOption, ReleasesDisplayOptions} from './releasesDisplayOptions';
import {ReleasesSortOptions} from './releasesSortOptions';
import {ReleasesStatusOption, ReleasesStatusOptions} from './releasesStatusOptions';
import {validateSummaryStatsPeriod} from './utils';

type ReleaseTab = 'releases' | 'mobile-builds' | 'snapshots';

const RELEASE_FILTER_KEYS = [
  ...Object.values(SEMVER_TAGS),
  {
    key: 'release',
    name: 'release',
  },
  {
    key: FieldKey.RELEASE_CREATED,
    name: FieldKey.RELEASE_CREATED,
  },
].reduce<TagCollection>((acc, tag) => {
  acc[tag.key] = tag;
  return acc;
}, {});

const releasesListParsers = {
  project: parseAsStringArray,
  environment: parseAsStringArray,
  statsPeriod: parseAsString,
  cursor: parseAsString,
  query: parseAsString,
  sort: parseAsString,
  display: parseAsString,
  status: parseAsString,
  tab: parseAsString,
};

const serializeReleasesListQuery = createSerializer(releasesListParsers);

function makeReleaseListApiOptions({
  organizationSlug,
  queryParams,
  activeSort,
  activeStatus,
}: {
  organizationSlug: string;
  queryParams: inferParserType<typeof releasesListParsers>;
  activeSort?: ReleasesSortOption;
  activeStatus?: ReleasesStatusOption;
}) {
  return apiOptions.as<Release[]>()('/organizations/$organizationIdOrSlug/releases/', {
    path: {organizationIdOrSlug: organizationSlug},
    query: {
      project: queryParams.project,
      environment: queryParams.environment,
      cursor: queryParams.cursor ?? undefined,
      query: queryParams.query ?? undefined,
      sort: queryParams.sort ?? undefined,
      summaryStatsPeriod: validateSummaryStatsPeriod(
        queryParams.statsPeriod || undefined
      ),
      per_page: 20,
      flatten: activeSort === ReleasesSortOption.DATE ? 0 : 1,
      adoptionStages: 1,
      status:
        activeStatus === ReleasesStatusOption.ARCHIVED
          ? ReleaseStatus.ARCHIVED
          : ReleaseStatus.ACTIVE,
    },
    staleTime: Infinity,
  });
}

const releasesFeedbackOptions = {
  messagePlaceholder: t('How can we improve the Releases experience?'),
  tags: {
    'feedback.source': 'releases-list-header',
  },
};

function ReleasesListInnerPage() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const location = useLocation();
  const [queryParams, setQueryParams] = useQueryStates(releasesListParsers);

  // date filter should reflect updated statsPeriod value
  useEffect(() => {
    const currentStatsPeriod = queryParams.statsPeriod;
    const validatedStatsPeriod = validateSummaryStatsPeriod(
      currentStatsPeriod || undefined
    );

    // if the validated value is different from the current value, update the URL
    if (currentStatsPeriod && currentStatsPeriod !== validatedStatsPeriod) {
      setQueryParams({statsPeriod: validatedStatsPeriod});
    }
  }, [queryParams.statsPeriod, setQueryParams]);

  const activeQuery = queryParams.query ?? '';

  const activeSort = useMemo(() => {
    const locationSort = queryParams.sort;

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
  }, [selection.environments, queryParams.sort]);

  const activeDisplay = useMemo(() => {
    switch (queryParams.display) {
      case ReleasesDisplayOption.USERS:
        return ReleasesDisplayOption.USERS;
      default:
        return ReleasesDisplayOption.SESSIONS;
    }
  }, [queryParams.display]);

  const activeStatus = useMemo(() => {
    switch (queryParams.status) {
      case ReleasesStatusOption.ARCHIVED:
        return ReleasesStatusOption.ARCHIVED;
      default:
        return ReleasesStatusOption.ACTIVE;
    }
  }, [queryParams.status]);

  const selectedProject = useMemo(() => {
    // Return the first project when 'All Projects' is displayed.
    // This ensures the onboarding panel is shown correctly, for example.
    if (selection.projects.length === 0) {
      return projects[0];
    }

    const selectedProjectId = selection.projects?.length === 1 && selection.projects[0];
    return projects?.find(p => p.id === `${selectedProjectId}`);
  }, [selection.projects, projects]);

  // Get selected project IDs, handling "All Projects" case
  const selectedProjectIds = useMemo(() => {
    const selectedIds = selection.projects.filter(id => id !== ALL_ACCESS_PROJECTS);

    // If no specific projects selected, pass [-1] to represent "all projects"
    // This avoids expanding to hundreds of project IDs which causes URL length issues
    return selectedIds.length === 0
      ? [`${ALL_ACCESS_PROJECTS}`]
      : selectedIds.map(id => `${id}`);
  }, [selection.projects]);

  const {statsPeriod, start, end, utc} = normalizeDateTimeParams(location.query);
  const buildsProbeQuery = useQuery({
    ...buildDetailsApiOptions({
      organization,
      queryParams: {
        per_page: 1,
        project: selectedProjectIds,
        ...(statsPeriod && {statsPeriod}),
        ...(start && {start}),
        ...(end && {end}),
        ...(utc && {utc}),
      },
    }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const hasAnyStrictlyMobileProject = useMemo(() => {
    const isAllProjects =
      selectedProjectIds.length === 1 &&
      selectedProjectIds[0] === `${ALL_ACCESS_PROJECTS}`;
    const projectIdsToCheck = isAllProjects
      ? projects.map(p => p.id)
      : selectedProjectIds;

    return projectIdsToCheck
      .map(id => ProjectsStore.getById(id))
      .filter(Boolean)
      .some(project => project?.platform && isMobileRelease(project.platform, false));
  }, [selectedProjectIds, projects]);

  const hasBuildsData =
    !buildsProbeQuery.isPending && (buildsProbeQuery.data?.length ?? 0) > 0;

  const shouldShowMobileBuildsTab = hasBuildsData || hasAnyStrictlyMobileProject;

  const selectedTab = useMemo(() => {
    const tab = (queryParams.tab || undefined) as ReleaseTab | undefined;
    if (tab === 'mobile-builds' && !shouldShowMobileBuildsTab) {
      return 'releases';
    }
    return tab || 'releases';
  }, [shouldShowMobileBuildsTab, queryParams.tab]);

  const {
    data,
    isPending: isReleasesPending,
    isRefetching: isReleasesRefetching,
    error: releasesError,
  } = useQuery({
    ...makeReleaseListApiOptions({
      organizationSlug: organization.slug,
      queryParams,
      activeSort,
      activeStatus,
    }),
    enabled: selectedTab === 'releases',
    select: selectJsonWithHeaders,
    placeholderData: keepPreviousData,
  });

  const releases = data?.json;

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
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [releases]);

  const selectedProjects = useSelectedProjectsForLLMContext();

  useLLMContext({
    contextHint:
      'Sentry releases list page. Shows deployed releases with crash-free rates, adoption, and session/user health. ' +
      'Users can search, sort, filter by status (active/archived), and toggle sessions vs users display. ' +
      'You can search live telemetry filtered by release to query related errors, spans, or logs (e.g. "errors in release 1.2.3 in the last 7 days"). ' +
      'projectSelectionInstruction describes the page-filter project scope (explicit pins vs My/All Projects). ' +
      'When projectIds/projectSlugs are empty, that is expected for My/All Projects — follow projectSelectionInstruction.',
    searchQuery: activeQuery,
    activeSort,
    activeDisplay,
    activeStatus,
    selectedTab,
    currentSelectedDateRange: selection.datetime,
    ...toLLMContextProjectFields(selectedProjects),
  });

  const handleSearch = useCallback(
    (query: string) => {
      setQueryParams({cursor: null, query}, {history: 'push'});
    },
    [setQueryParams]
  );

  const handleSortBy = useCallback(
    (sort: string) => {
      setQueryParams({cursor: null, sort}, {history: 'push'});
    },
    [setQueryParams]
  );

  const handleDisplay = useCallback(
    (display: string) => {
      let sort = queryParams.sort;
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

      setQueryParams({cursor: null, display, sort}, {history: 'push'});
    },
    [queryParams.sort, setQueryParams]
  );

  const handleStatus = useCallback(
    (status: string) => {
      setQueryParams({cursor: null, status}, {history: 'push'});
    },
    [setQueryParams]
  );

  const handleTabChange = (newTab: string) => {
    if (newTab === 'mobile-builds') {
      trackAnalytics('preprod.releases.mobile-builds.tab-clicked', {
        organization,
      });
    } else if (newTab === 'snapshots') {
      trackAnalytics('preprod.releases.snapshots.tab-clicked', {
        organization,
      });
    }
  };

  const tagValueLoader = useCallback(
    (key: string, search: string) => {
      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: key,
        search,
        projectIds: queryParams.project,
        endpointParams: normalizeDateTimeParams(location.query),
      });
    },
    [api, location, organization, queryParams.project]
  );

  const getTagValues = useCallback<GetTagValues>(
    async ({tag, searchQuery}) => {
      const values = await tagValueLoader(tag.key, searchQuery);
      return values.map(({value}) => value).filter(defined);
    },
    [tagValueLoader]
  );

  const hasAnyMobileProject = useMemo(() => {
    // When "All Projects" is selected (represented by [-1]), check all accessible projects
    // When specific projects are selected, check only those projects
    const isAllProjects =
      selectedProjectIds.length === 1 &&
      selectedProjectIds[0] === `${ALL_ACCESS_PROJECTS}`;
    const projectIdsToCheck = isAllProjects
      ? projects.map(p => p.id)
      : selectedProjectIds;

    return projectIdsToCheck
      .map(id => ProjectsStore.getById(id))
      .filter(Boolean)
      .some(project => project?.platform && isMobileRelease(project.platform));
  }, [selectedProjectIds, projects]);

  const showReleaseAdoptionStages =
    hasAnyMobileProject && selection.environments.length === 1;
  const shouldShowQuickstart = Boolean(
    selectedProject &&
    // Has not set up releases
    !selectedProject?.features.includes('releases') &&
    // Has no releases
    !releases?.length
  );
  const releasesPageLinks = data?.headers.Link;

  const releasesErrorMessage = useMemo(() => {
    if (!releasesError) {
      return null;
    }
    if (releasesError instanceof RequestError && releasesError.status === 400) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(releasesError.responseJSON?.detail);
    }
    return t('There was an error loading releases');
  }, [releasesError]);

  return (
    <PageFiltersContainer showAbsolute={false} defaultSelection={selection}>
      <SentryDocumentTitle title={t('Releases')} orgSlug={organization.slug} />
      <Stack flex={1}>
        <NoProjectMessage organization={organization}>
          <ReleasesHeader />
          <ReleasesBodySearch>
            <Layout.Main width="full">
              <Stack gap="md">
                <Container width={{zero: '100%', md: 'max-content'}}>
                  {containerProps => (
                    <PageFilterBar {...containerProps} condensed>
                      <ProjectPageFilter />
                      <EnvironmentPageFilter
                        disabled={
                          selectedTab === 'mobile-builds' || selectedTab === 'snapshots'
                        }
                      />
                      <DatePageFilter
                        disallowArbitraryRelativeRanges
                        menuFooterMessage={t(
                          'Changing this date range will recalculate the release metrics. Select a supported date range from the options above.'
                        )}
                      />
                    </PageFilterBar>
                  )}
                </Container>
                <Tabs value={selectedTab} onChange={handleTabChange}>
                  <TabList aria-label={t('Releases tab selector')}>
                    <TabList.Item
                      key="releases"
                      to={{
                        pathname: location.pathname,
                        search: serializeReleasesListQuery(location.search, {
                          query: null,
                          tab: null,
                        }),
                      }}
                      textValue={t('Releases')}
                    >
                      {t('Releases')}
                    </TabList.Item>
                    <TabList.Item
                      key="mobile-builds"
                      hidden={!shouldShowMobileBuildsTab}
                      to={{
                        pathname: location.pathname,
                        search: serializeReleasesListQuery(location.search, {
                          query: null,
                          tab: 'mobile-builds',
                        }),
                      }}
                      textValue={t('Mobile Builds')}
                    >
                      <Flex align="center" gap="sm">
                        {t('Mobile Builds')}
                        <FeatureBadge type="new" />
                      </Flex>
                    </TabList.Item>
                    <TabList.Item
                      key="snapshots"
                      to={{
                        pathname: location.pathname,
                        search: serializeReleasesListQuery(location.search, {
                          query: null,
                          tab: 'snapshots',
                        }),
                      }}
                      textValue={t('Snapshots')}
                    >
                      <Flex align="center" gap="sm">
                        {t('Snapshots')}
                        <FeatureBadge type="beta" />
                      </Flex>
                    </TabList.Item>
                  </TabList>
                </Tabs>
              </Stack>
            </Layout.Main>
          </ReleasesBodySearch>
          <ExploreBodyContent>
            <ExploreContentSection gap="xl">
              {selectedTab === 'mobile-builds' && (
                <MobileBuilds
                  organization={organization}
                  selectedProjectIds={selectedProjectIds}
                />
              )}

              {selectedTab === 'snapshots' && (
                <MobileBuilds
                  organization={organization}
                  selectedProjectIds={selectedProjectIds}
                  defaultDisplay={PreprodBuildsDisplay.SNAPSHOT}
                  hideDisplayToggle
                />
              )}

              {selectedTab === 'releases' && (
                <Fragment>
                  <ReleaseHealthCTA
                    organization={organization}
                    releases={releases ?? []}
                    selectedProject={selectedProject}
                    selection={selection}
                  />
                  {shouldShowQuickstart ? null : (
                    <Grid
                      columns={{
                        zero: 'minmax(0, 1fr)',
                        md: 'repeat(3, 1fr)',
                        '2xl': '1fr repeat(3, max-content)',
                      }}
                      gap="xl"
                    >
                      <Container column={{zero: 'auto', md: '1 / -1', '2xl': 'auto'}}>
                        {containerProps => (
                          <SearchQueryBuilder
                            {...containerProps}
                            onSearch={handleSearch}
                            initialQuery={activeQuery}
                            filterKeys={RELEASE_FILTER_KEYS}
                            getTagValues={getTagValues}
                            placeholder={t('Search by version, build, package, or stage')}
                            searchSource="releases"
                          />
                        )}
                      </Container>
                      <ReleasesStatusOptions
                        selected={activeStatus}
                        onSelect={handleStatus}
                      />
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
                    </Grid>
                  )}

                  {!(isReleasesPending || isReleasesRefetching) &&
                    activeStatus === ReleasesStatusOption.ARCHIVED &&
                    !!releases?.length && <ReleaseArchivedNotice multi />}

                  {releasesErrorMessage ? (
                    <LoadingError message={releasesErrorMessage} />
                  ) : (
                    <DemoTourElement
                      id={DemoTourStep.RELEASES_LIST}
                      title={t('Latest releases')}
                      description={t(
                        'View the latest releases for your project. Select a release to review new and regressed issues, and business critical metrics like crash rate, and user adoption. '
                      )}
                    >
                      {props => (
                        <div {...props}>
                          <ReleaseListInner
                            activeDisplay={activeDisplay}
                            activeQuery={activeQuery}
                            activeSort={activeSort}
                            activeStatus={activeStatus}
                            loading={isReleasesPending}
                            organization={organization}
                            releases={releases ?? []}
                            releasesPageLinks={releasesPageLinks}
                            reloading={isReleasesRefetching}
                            selectedProject={selectedProject}
                            selection={selection}
                            shouldShowQuickstart={shouldShowQuickstart}
                            showReleaseAdoptionStages={showReleaseAdoptionStages}
                          />
                        </div>
                      )}
                    </DemoTourElement>
                  )}
                </Fragment>
              )}
            </ExploreContentSection>
          </ExploreBodyContent>
        </NoProjectMessage>
      </Stack>
    </PageFiltersContainer>
  );
}

function ReleasesHeader() {
  return (
    <Fragment>
      <TopBar.Slot
        name="breadcrumbs"
        title={{
          type: 'page-title',
          label: t('Releases'),
          labelTooltip: (
            <DocumentationHint docsUrl="https://docs.sentry.io/product/releases/">
              {t(
                'A visualization of your release adoption from the past 24 hours, providing a high-level view of the adoption stage, percentage of crash-free users and sessions, and more.'
              )}
            </DocumentationHint>
          ),
        }}
      />
      <TopBar.Slot name="feedback">
        <FeedbackButton
          feedbackOptions={releasesFeedbackOptions}
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}

function ReleasesBodySearch({children}: {children: React.ReactNode}) {
  return (
    <Container paddingBottom="0">
      {containerProps => (
        <ExploreBodySearch {...containerProps}>{children}</ExploreBodySearch>
      )}
    </Container>
  );
}

export default registerLLMContext('releases-list', ReleasesListInnerPage);
