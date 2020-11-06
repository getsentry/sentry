import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import {forceCheck} from 'react-lazyload';

import {t} from 'app/locale';
import space from 'app/styles/space';
import AsyncView from 'app/views/asyncView';
import {Organization, Release, GlobalSelection} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import PageHeading from 'app/components/pageHeading';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import LoadingIndicator from 'app/components/loadingIndicator';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {PageContent, PageHeader} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';

import ReleaseListSortOptions from './releaseListSortOptions';
import ReleaseLanding from './releaseLanding';
import IntroBanner from './introBanner';
import ReleaseCard from './releaseCard';
import ReleaseListDisplayOptions from './releaseListDisplayOptions';
import ReleaseArchivedNotice from '../detail/overview/releaseArchivedNotice';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  selection: GlobalSelection;
};

type State = {
  releases: Release[];
  loadingHealth: boolean;
} & AsyncView['state'];

class ReleasesList extends AsyncView<Props, State> {
  shouldReload = true;

  getTitle() {
    return routeTitleGen(t('Releases'), this.props.organization.slug, false);
  }

  getEndpoints() {
    const {organization, location} = this.props;
    const {statsPeriod} = location.query;
    const sort = this.getSort();
    const display = this.getDisplay();

    const query = {
      ...pick(location.query, [
        'project',
        'environment',
        'cursor',
        'query',
        'sort',
        'healthStatsPeriod',
        'healthStat',
      ]),
      summaryStatsPeriod: statsPeriod,
      per_page: 25,
      health: 1,
      flatten: sort === 'date' ? 0 : 1,
      archived: display === 'archived' ? 1 : 0,
    };

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['releasesWithHealth', `/organizations/${organization.slug}/releases/`, {query}],
    ];

    // when sorting by date we fetch releases without health and then fetch health lazily
    if (sort === 'date') {
      endpoints.push([
        'releasesWithoutHealth',
        `/organizations/${organization.slug}/releases/`,
        {query: {...query, health: 0}},
      ]);
    }

    return endpoints;
  }

  onRequestSuccess({stateKey, data, jqXHR}) {
    const {remainingRequests} = this.state;

    // make sure there's no withHealth/withoutHealth race condition and set proper loading state
    if (stateKey === 'releasesWithHealth' || remainingRequests === 1) {
      this.setState({
        reloading: false,
        loading: false,
        loadingHealth: stateKey === 'releasesWithoutHealth',
        releases: data,
        releasesPageLinks: jqXHR?.getResponseHeader('Link'),
      });
    }
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

  getSort() {
    const {sort} = this.props.location.query;

    return typeof sort === 'string' ? sort : 'date';
  }

  getDisplay() {
    const {display} = this.props.location.query;

    return typeof display === 'string' ? display : 'active';
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleSort = (sort: string) => {
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

  shouldShowLoadingIndicator() {
    const {loading, releases, reloading} = this.state;

    return (loading && !reloading) || (loading && !releases?.length);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmptyMessage() {
    const {location, organization} = this.props;
    const {statsPeriod} = location.query;
    const searchQuery = this.getQuery();
    const activeSort = this.getSort();

    if (searchQuery && searchQuery.length) {
      return (
        <EmptyStateWarning small>{`${t(
          'There are no releases that match'
        )}: '${searchQuery}'.`}</EmptyStateWarning>
      );
    }

    if (activeSort === 'users_24h') {
      return (
        <EmptyStateWarning small>
          {t('There are no releases with active user data (users in the last 24 hours).')}
        </EmptyStateWarning>
      );
    }

    if (activeSort !== 'date') {
      const relativePeriod = getRelativeSummary(
        statsPeriod || DEFAULT_STATS_PERIOD
      ).toLowerCase();

      return (
        <EmptyStateWarning small>
          {`${t('There are no releases with data in the')} ${relativePeriod}.`}
        </EmptyStateWarning>
      );
    }

    if (defined(statsPeriod) && statsPeriod !== '14d') {
      return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
    }

    return <ReleaseLanding organization={organization} />;
  }

  renderInnerBody() {
    const {location, selection, organization} = this.props;
    const {releases, reloading, loadingHealth} = this.state;

    if (this.shouldShowLoadingIndicator()) {
      return <LoadingIndicator />;
    }

    if (!releases?.length) {
      return this.renderEmptyMessage();
    }

    return releases.map(release => (
      <ReleaseCard
        release={release}
        orgSlug={organization.slug}
        location={location}
        selection={selection}
        reloading={reloading}
        key={`${release.version}-${release.projects[0].slug}`}
        showHealthPlaceholders={loadingHealth}
      />
    ));
  }

  renderBody() {
    const {organization} = this.props;
    const {releasesPageLinks} = this.state;

    return (
      <GlobalSelectionHeader
        showAbsolute={false}
        timeRangeHint={t(
          'Changing this date range will recalculate the release metrics.'
        )}
      >
        <PageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <StyledPageHeader>
              <PageHeading>{t('Releases')}</PageHeading>
              <SortAndFilterWrapper>
                <ReleaseListDisplayOptions
                  selected={this.getDisplay()}
                  onSelect={this.handleDisplay}
                />
                <ReleaseListSortOptions
                  selected={this.getSort()}
                  onSelect={this.handleSort}
                />
                <SearchBar
                  placeholder={t('Search')}
                  onSearch={this.handleSearch}
                  query={this.getQuery()}
                />
              </SortAndFilterWrapper>
            </StyledPageHeader>

            <IntroBanner />

            {this.getDisplay() === 'archived' && <ReleaseArchivedNotice multi />}

            {this.renderInnerBody()}

            <Pagination pageLinks={releasesPageLinks} />
          </LightWeightNoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
    );
  }
}

const StyledPageHeader = styled(PageHeader)`
  flex-wrap: wrap;
  margin-bottom: 0;
  ${PageHeading} {
    margin-bottom: ${space(2)};
    margin-right: ${space(2)};
  }
`;
const SortAndFilterWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto auto 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    grid-template-columns: none;
    grid-template-rows: 1fr 1fr 1fr;
    margin-bottom: ${space(4)};
  }
`;

export default withOrganization(withGlobalSelection(ReleasesList));
export {ReleasesList};
