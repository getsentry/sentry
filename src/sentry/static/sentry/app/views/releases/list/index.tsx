import React from 'react';
import {forceCheck} from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Feature from 'app/components/acl/feature';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Release, ReleaseStatus} from 'app/types';
import {defined} from 'app/utils';
import routeTitleGen from 'app/utils/routeTitle';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

import ReleaseArchivedNotice from '../detail/overview/releaseArchivedNotice';
import ReleaseHealthRequest from '../utils/releaseHealthRequest';

import ReleaseCard from './releaseCard';
import ReleaseDisplayOptions from './releaseDisplayOptions';
import ReleaseLanding from './releaseLanding';
import ReleaseListSortOptions from './releaseListSortOptions';
import ReleaseListStatusOptions from './releaseListStatusOptions';
import ReleasesStabilityChart from './releasesStabilityChart';
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

  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);

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

  renderInnerBody(activeDisplay: DisplayOption) {
    const {location, selection, organization} = this.props;
    const {releases, reloading, releasesPageLinks} = this.state;

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
        {({isHealthLoading, getHealthData}) => (
          <React.Fragment>
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
          </React.Fragment>
        )}
      </ReleaseHealthRequest>
    );
  }

  renderBody() {
    const {organization, location, router, selection} = this.props;
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

            <Feature features={['releases-top-charts']} organization={organization}>
              {/* We are only displaying charts if single project is selected */}
              {selection.projects.length === 1 &&
                !selection.projects.includes(ALL_ACCESS_PROJECTS) && (
                  <ReleasesStabilityChart
                    location={location}
                    organization={organization}
                    router={router}
                  />
                )}
            </Feature>

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
