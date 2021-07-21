import {Fragment} from 'react';
import {forceCheck} from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchTagValues} from 'app/actionCreators/tags';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {GuideAnchor} from 'app/components/assistant/guideAnchor';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import SmartSearchBar from 'app/components/smartSearchBar';
import {DEFAULT_STATS_PERIOD, RELEASE_ADOPTION_STAGES} from 'app/constants';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {desktop, mobile, PlatformKey, releaseHealth} from 'app/data/platformCategories';
import {IconInfo} from 'app/icons';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {
  GlobalSelection,
  Organization,
  Project,
  Release,
  ReleaseStatus,
  SessionApiResponse,
  Tag,
} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Projects from 'app/utils/projects';
import routeTitleGen from 'app/utils/routeTitle';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

import ReleaseArchivedNotice from '../detail/overview/releaseArchivedNotice';
import ReleaseHealthRequest from '../utils/releaseHealthRequest';

import ReleaseAdoptionChart from './releaseAdoptionChart';
import ReleaseCard from './releaseCard';
import ReleaseDisplayOptions from './releaseDisplayOptions';
import ReleaseListSortOptions from './releaseListSortOptions';
import ReleaseListStatusOptions from './releaseListStatusOptions';
import ReleasePromo from './releasePromo';
import {DisplayOption, SortOption, StatusOption} from './utils';

const supportedTags = {
  'release.version': {
    key: 'release.version',
    name: 'release.version',
  },
  'release.build': {
    key: 'release.build',
    name: 'release.build',
  },
  'release.package': {
    key: 'release.package',
    name: 'release.package',
  },
  'release.stage': {
    key: 'release.stage',
    name: 'release.stage',
    predefined: true,
    values: RELEASE_ADOPTION_STAGES,
  },
  release: {
    key: 'release',
    name: 'release',
  },
};

export const isProjectMobileForReleases = (projectPlatform: PlatformKey) =>
  (
    [...mobile, ...desktop, 'java-android', 'cocoa-objc', 'cocoa-swift'] as string[]
  ).includes(projectPlatform);

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  selection: GlobalSelection;
};

type State = {
  releases: Release[];
  hasSessions: boolean | null;
} & AsyncView['state'];

class ReleasesList extends AsyncView<Props, State> {
  shouldReload = true;
  shouldRenderBadRequests = true;

  getTitle() {
    return routeTitleGen(t('Releases'), this.props.organization.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, location} = this.props;
    const {statsPeriod} = location.query;
    const activeSort = this.getSort();
    const activeStatus = this.getStatus();

    const query = {
      ...pick(location.query, ['project', 'environment', 'cursor', 'query', 'sort']),
      summaryStatsPeriod: statsPeriod,
      per_page: 20,
      flatten: activeSort === SortOption.DATE ? 0 : 1,
      adoptionStages: 1,
      status:
        activeStatus === StatusOption.ARCHIVED
          ? ReleaseStatus.Archived
          : ReleaseStatus.Active,
    };

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'releases',
        `/organizations/${organization.slug}/releases/`,
        {query},
        {disableEntireQuery: true},
      ],
    ];

    return endpoints;
  }

  componentDidMount() {
    if (this.props.location.query.project) {
      this.fetchSessionsExistence();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);

    if (prevProps.location.query.project !== this.props.location.query.project) {
      this.fetchSessionsExistence();
    }

    if (prevState.releases !== this.state.releases) {
      /**
       * Manually trigger checking for elements in viewport.
       * Helpful when LazyLoad components enter the viewport without resize or scroll events,
       * https://github.com/twobin/react-lazyload#forcecheck
       *
       * HealthStatsCharts are being rendered only when they are scrolled into viewport.
       * This is how we re-check them without scrolling once releases change as this view
       * uses shouldReload=true and there is no reloading happening.
       */
      forceCheck();
    }
  }

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getSort(): SortOption {
    const {sort} = this.props.location.query;

    switch (sort) {
      case SortOption.CRASH_FREE_USERS:
        return SortOption.CRASH_FREE_USERS;
      case SortOption.CRASH_FREE_SESSIONS:
        return SortOption.CRASH_FREE_SESSIONS;
      case SortOption.SESSIONS:
        return SortOption.SESSIONS;
      case SortOption.USERS_24_HOURS:
        return SortOption.USERS_24_HOURS;
      case SortOption.SESSIONS_24_HOURS:
        return SortOption.SESSIONS_24_HOURS;
      case SortOption.BUILD:
        return SortOption.BUILD;
      case SortOption.SEMVER:
        return SortOption.SEMVER;
      case SortOption.ADOPTION:
        return SortOption.ADOPTION;
      default:
        return SortOption.DATE;
    }
  }

  getDisplay(): DisplayOption {
    const {display} = this.props.location.query;

    switch (display) {
      case DisplayOption.USERS:
        return DisplayOption.USERS;
      default:
        return DisplayOption.SESSIONS;
    }
  }

  getStatus(): StatusOption {
    const {status} = this.props.location.query;

    switch (status) {
      case StatusOption.ARCHIVED:
        return StatusOption.ARCHIVED;
      default:
        return StatusOption.ACTIVE;
    }
  }

  getSelectedProject(): Project | undefined {
    const {selection, organization} = this.props;

    const selectedProjectId =
      selection.projects && selection.projects.length === 1 && selection.projects[0];
    return organization.projects?.find(p => p.id === `${selectedProjectId}`);
  }

  async fetchSessionsExistence() {
    const {organization, location} = this.props;
    const projectId = location.query.project;
    if (!projectId) {
      return;
    }

    this.setState({
      hasSessions: null,
    });

    try {
      const response: SessionApiResponse = await this.api.requestPromise(
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            project: projectId,
            field: 'sum(session)',
            statsPeriod: '90d',
            interval: '1d',
          },
        }
      );
      this.setState({
        hasSessions: response.groups[0].totals['sum(session)'] > 0,
      });
    } catch {
      // do nothing
    }
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleSortBy = (sort: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, sort},
    });
  };

  handleDisplay = (display: string) => {
    const {location, router} = this.props;

    let sort = location.query.sort;
    if (sort === SortOption.USERS_24_HOURS && display === DisplayOption.SESSIONS)
      sort = SortOption.SESSIONS_24_HOURS;
    else if (sort === SortOption.SESSIONS_24_HOURS && display === DisplayOption.USERS)
      sort = SortOption.USERS_24_HOURS;
    else if (sort === SortOption.CRASH_FREE_USERS && display === DisplayOption.SESSIONS)
      sort = SortOption.CRASH_FREE_SESSIONS;
    else if (sort === SortOption.CRASH_FREE_SESSIONS && display === DisplayOption.USERS)
      sort = SortOption.CRASH_FREE_USERS;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, display, sort},
    });
  };

  handleStatus = (status: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, status},
    });
  };

  trackAddReleaseHealth = () => {
    const {organization, selection} = this.props;

    if (organization.id && selection.projects[0]) {
      trackAnalyticsEvent({
        eventKey: `releases_list.click_add_release_health`,
        eventName: `Releases List: Click Add Release Health`,
        organization_id: parseInt(organization.id, 10),
        project_id: selection.projects[0],
      });
    }
  };

  tagValueLoader = (key: string, search: string) => {
    const {location, organization} = this.props;
    const {project: projectId} = location.query;

    return fetchTagValues(
      this.api,
      organization.slug,
      key,
      search,
      projectId ? [projectId] : null,
      location.query
    );
  };

  getTagValues = async (tag: Tag, currentQuery: string): Promise<string[]> => {
    const values = await this.tagValueLoader(tag.key, currentQuery);
    return values.map(({value}) => value);
  };

  shouldShowLoadingIndicator() {
    const {loading, releases, reloading} = this.state;

    return (loading && !reloading) || (loading && !releases?.length);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return this.renderBody();
  }

  renderEmptyMessage() {
    const {location, organization, selection} = this.props;
    const {statsPeriod} = location.query;
    const searchQuery = this.getQuery();
    const activeSort = this.getSort();
    const activeStatus = this.getStatus();

    if (searchQuery && searchQuery.length) {
      return (
        <EmptyStateWarning small>{`${t(
          'There are no releases that match'
        )}: '${searchQuery}'.`}</EmptyStateWarning>
      );
    }

    if (activeSort === SortOption.USERS_24_HOURS) {
      return (
        <EmptyStateWarning small>
          {t('There are no releases with active user data (users in the last 24 hours).')}
        </EmptyStateWarning>
      );
    }

    if (activeSort === SortOption.SESSIONS_24_HOURS) {
      return (
        <EmptyStateWarning small>
          {t(
            'There are no releases with active session data (sessions in the last 24 hours).'
          )}
        </EmptyStateWarning>
      );
    }

    if (activeSort === SortOption.BUILD || activeSort === SortOption.SEMVER) {
      return (
        <EmptyStateWarning small>
          {t('There are no releases with semantic versioning.')}
        </EmptyStateWarning>
      );
    }

    if (activeSort !== SortOption.DATE) {
      const relativePeriod = getRelativeSummary(
        statsPeriod || DEFAULT_STATS_PERIOD
      ).toLowerCase();

      return (
        <EmptyStateWarning small>
          {`${t('There are no releases with data in the')} ${relativePeriod}.`}
        </EmptyStateWarning>
      );
    }

    if (activeStatus === StatusOption.ARCHIVED) {
      return (
        <EmptyStateWarning small>
          {t('There are no archived releases.')}
        </EmptyStateWarning>
      );
    }

    return (
      <ReleasePromo
        organization={organization}
        projectId={selection.projects.filter(p => p !== ALL_ACCESS_PROJECTS)[0]}
      />
    );
  }

  renderHealthCta() {
    const {organization} = this.props;
    const {hasSessions, releases} = this.state;

    const selectedProject = this.getSelectedProject();

    if (!selectedProject || hasSessions !== false || !releases?.length) {
      return null;
    }

    return (
      <Projects orgId={organization.slug} slugs={[selectedProject.slug]}>
        {({projects, initiallyLoaded, fetchError}) => {
          const project = projects && projects.length === 1 && projects[0];
          const projectCanHaveReleases =
            project && project.platform && releaseHealth.includes(project.platform);

          if (!initiallyLoaded || fetchError || !projectCanHaveReleases) {
            return null;
          }

          return (
            <Alert type="info" icon={<IconInfo size="md" />}>
              <AlertText>
                <div>
                  {t(
                    'To track user adoption, crash rates, session data and more, add Release Health to your current setup.'
                  )}
                </div>
                <ExternalLink
                  href="https://docs.sentry.io/product/releases/health/setup/"
                  onClick={this.trackAddReleaseHealth}
                >
                  {t('Add Release Health')}
                </ExternalLink>
              </AlertText>
            </Alert>
          );
        }}
      </Projects>
    );
  }

  renderInnerBody(activeDisplay: DisplayOption) {
    const {location, selection, organization, router} = this.props;
    const {hasSessions, releases, reloading, releasesPageLinks} = this.state;

    if (this.shouldShowLoadingIndicator()) {
      return <LoadingIndicator />;
    }

    if (!releases?.length) {
      return this.renderEmptyMessage();
    }

    return (
      <ReleaseHealthRequest
        releases={releases.map(({version}) => version)}
        organization={organization}
        selection={selection}
        location={location}
        display={[this.getDisplay()]}
        releasesReloading={reloading}
        healthStatsPeriod={location.query.healthStatsPeriod}
      >
        {({isHealthLoading, getHealthData}) => {
          const singleProjectSelected =
            selection.projects?.length === 1 &&
            selection.projects[0] !== ALL_ACCESS_PROJECTS;
          const selectedProject = this.getSelectedProject();
          const isMobileProject =
            selectedProject?.platform &&
            isProjectMobileForReleases(selectedProject.platform);

          return (
            <Fragment>
              {singleProjectSelected && hasSessions && isMobileProject && (
                <Feature features={['organizations:release-adoption-chart']}>
                  <ReleaseAdoptionChart
                    organization={organization}
                    selection={selection}
                    location={location}
                    router={router}
                    activeDisplay={activeDisplay}
                  />
                </Feature>
              )}

              {releases.map((release, index) => (
                <ReleaseCard
                  key={`${release.version}-${release.projects[0].slug}`}
                  activeDisplay={activeDisplay}
                  release={release}
                  organization={organization}
                  location={location}
                  selection={selection}
                  reloading={reloading}
                  showHealthPlaceholders={isHealthLoading}
                  isTopRelease={index === 0}
                  getHealthData={getHealthData}
                />
              ))}
              <Pagination pageLinks={releasesPageLinks} />
            </Fragment>
          );
        }}
      </ReleaseHealthRequest>
    );
  }

  renderBody() {
    const {organization} = this.props;
    const {releases, reloading, error} = this.state;

    const activeSort = this.getSort();
    const activeStatus = this.getStatus();
    const activeDisplay = this.getDisplay();

    const hasSemver = organization.features.includes('semver');

    return (
      <GlobalSelectionHeader
        showAbsolute={false}
        timeRangeHint={t(
          'Changing this date range will recalculate the release metrics.'
        )}
      >
        <PageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <PageHeader>
              <PageHeading>{t('Releases')}</PageHeading>
            </PageHeader>

            {this.renderHealthCta()}

            <SortAndFilterWrapper>
              {hasSemver ? (
                <GuideAnchor target="releases_search" position="bottom">
                  <SmartSearchBar
                    searchSource="releases"
                    query={this.getQuery()}
                    placeholder={t('Search by release version')}
                    maxSearchItems={5}
                    hasRecentSearches={false}
                    supportedTags={supportedTags}
                    onSearch={this.handleSearch}
                    onGetTagValues={this.getTagValues}
                  />
                </GuideAnchor>
              ) : (
                <SearchBar
                  placeholder={t('Search')}
                  onSearch={this.handleSearch}
                  query={this.getQuery()}
                />
              )}
              <DropdownsWrapper>
                <ReleaseListStatusOptions
                  selected={activeStatus}
                  onSelect={this.handleStatus}
                />
                <ReleaseListSortOptions
                  selected={activeSort}
                  selectedDisplay={activeDisplay}
                  onSelect={this.handleSortBy}
                  organization={organization}
                />
                <ReleaseDisplayOptions
                  selected={activeDisplay}
                  onSelect={this.handleDisplay}
                />
              </DropdownsWrapper>
            </SortAndFilterWrapper>

            {!reloading &&
              activeStatus === StatusOption.ARCHIVED &&
              !!releases?.length && <ReleaseArchivedNotice multi />}

            {error
              ? super.renderError(new Error('Unable to load all required endpoints'))
              : this.renderInnerBody(activeDisplay)}
          </LightWeightNoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
    );
  }
}

const AlertText = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: ${space(2)};

  > *:nth-child(1) {
    flex: 1;
  }
  flex-direction: column;
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    flex-direction: row;
  }
`;

const SortAndFilterWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  margin-bottom: ${space(2)};

  > *:nth-child(1) {
    flex: 1;
  }

  /* Below this width search bar needs its own row no to wrap placeholder text
   * Above this width search bar and controls can be on the same row */
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    flex-direction: row;
  }
`;

const DropdownsWrapper = styled('div')`
  display: flex;
  flex-direction: column;

  & > * {
    margin-top: ${space(2)};
  }

  /* At the narrower widths wrapper is on its own in a row
   * Expand the dropdown controls to fill the empty space */
  & button {
    width: 100%;
  }

  /* At narrower widths space bar needs a separate row
   * Divide space evenly when 3 dropdowns are in their own row */
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(2)};

    & > * {
      margin-top: ${space(0)};
      margin-left: ${space(2)};
    }

    & > *:nth-child(1) {
      margin-left: ${space(0)};
    }

    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }

  /* At wider widths everything is in 1 row
   * Auto space dropdowns when they are in the same row with search bar */
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    margin-top: ${space(0)};

    & > * {
      margin-left: ${space(2)} !important;
    }

    display: grid;
    grid-template-columns: auto auto auto;
  }
`;

export default withOrganization(withGlobalSelection(ReleasesList));
export {ReleasesList};
