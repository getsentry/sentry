import {Fragment} from 'react';
import {forceCheck} from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {releaseHealth} from 'app/data/platformCategories';
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
} from 'app/types';
import {defined} from 'app/utils';
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
import ReleaseLanding from './releaseLanding';
import ReleaseListSortOptions from './releaseListSortOptions';
import ReleaseListStatusOptions from './releaseListStatusOptions';
import {DisplayOption, SortOption, StatusOption} from './utils';

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
      status:
        activeStatus === StatusOption.ARCHIVED
          ? ReleaseStatus.Archived
          : ReleaseStatus.Active,
    };

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['releases', `/organizations/${organization.slug}/releases/`, {query}],
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

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, display},
    });
  };

  handleStatus = (status: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, status},
    });
  };

  shouldShowLoadingIndicator() {
    const {loading, releases, reloading} = this.state;

    return (loading && !reloading) || (loading && !releases?.length);
  }

  renderLoading() {
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

    if (defined(statsPeriod) && statsPeriod !== '14d') {
      return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
    }

    return (
      <ReleaseLanding
        organization={organization}
        projectId={selection.projects.filter(p => p !== ALL_ACCESS_PROJECTS)[0]}
      />
    );
  }

  renderAlertBanner() {
    const {selection, organization} = this.props;
    const {hasSessions} = this.state;

    const selectedProjectId =
      selection.projects && selection.projects.length === 1 && selection.projects[0];
    const selectedProject = organization.projects.find(
      p => p.id === `${selectedProjectId}`
    );

    if (!selectedProject) {
      return null;
    }

    return (
      <Feature features={['organizations:release-adoption-chart']}>
        <Projects orgId={organization.slug} slugs={[selectedProject.slug]}>
          {({projects, initiallyLoaded, fetchError}) => {
            const project = projects && projects.length === 1 && projects[0];
            const projectCanHaveReleases =
              project && project.platform && releaseHealth.includes(project.platform);

            if (
              !initiallyLoaded ||
              fetchError ||
              !projectCanHaveReleases ||
              hasSessions
            ) {
              return null;
            }

            return (
              <Alert type="info" icon={<IconInfo size="md" />}>
                <AlertText>
                  <div>
                    {t(
                      'Setup Release Health for this project to view user adoption, usage of the application, percentage of crashes, and session data.'
                    )}
                  </div>
                  <ExternalLink href="https://docs.sentry.io/product/releases/health/">
                    {t('Learn more')}
                  </ExternalLink>
                </AlertText>
              </Alert>
            );
          }}
        </Projects>
      </Feature>
    );
  }

  renderInnerBody(activeDisplay: DisplayOption) {
    const {location, selection, organization} = this.props;
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
          const selectedProjectId =
            selection.projects &&
            selection.projects.length === 1 &&
            selection.projects[0];
          // TODO(releases): I think types here need adjusting as this can also be a lightweight organization without projects
          const selectedProject = organization.projects?.find(
            p => p.id === `${selectedProjectId}`
          );

          return (
            <Fragment>
              {selectedProject && (
                <Feature features={['organizations:release-adoption-chart']}>
                  <Projects orgId={organization.slug} slugs={[selectedProject.slug]}>
                    {({projects, initiallyLoaded, fetchError}) => {
                      const project = projects && projects.length === 1 && projects[0];

                      if (!initiallyLoaded || fetchError || !project || !hasSessions) {
                        return null;
                      }

                      const showPlaceholders = !initiallyLoaded || isHealthLoading;

                      let totalCount = 0;

                      if (releases?.length) {
                        const timeSeries = getHealthData.getTimeSeries(
                          releases[0].version,
                          Number(project.id),
                          activeDisplay
                        );

                        const totalData = timeSeries[1].data;

                        if (totalData.length) {
                          totalCount = totalData
                            .map(point => point.value)
                            .reduce((acc, value) => acc + value);
                        }
                      }

                      return (
                        <ReleaseAdoptionChart
                          organization={organization}
                          selection={selection}
                          releases={releases}
                          project={project as Project}
                          getHealthData={getHealthData}
                          activeDisplay={activeDisplay}
                          showPlaceholders={showPlaceholders}
                          totalCount={totalCount}
                        />
                      );
                    }}
                  </Projects>
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
    const {releases, reloading} = this.state;

    const activeSort = this.getSort();
    const activeStatus = this.getStatus();
    const activeDisplay = this.getDisplay();

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

            {this.renderAlertBanner()}

            <SortAndFilterWrapper>
              <SearchBar
                placeholder={t('Search')}
                onSearch={this.handleSearch}
                query={this.getQuery()}
              />
              <ReleaseListStatusOptions
                selected={activeStatus}
                onSelect={this.handleStatus}
              />
              <ReleaseListSortOptions
                selected={activeSort}
                onSelect={this.handleSortBy}
              />
              <ReleaseDisplayOptions
                selected={activeDisplay}
                onSelect={this.handleDisplay}
              />
            </SortAndFilterWrapper>

            {!reloading &&
              activeStatus === StatusOption.ARCHIVED &&
              !!releases?.length && <ReleaseArchivedNotice multi />}

            {this.renderInnerBody(activeDisplay)}
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
  display: inline-grid;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr repeat(3, auto);
  }
`;

export default withOrganization(withGlobalSelection(ReleasesList));
export {ReleasesList};
