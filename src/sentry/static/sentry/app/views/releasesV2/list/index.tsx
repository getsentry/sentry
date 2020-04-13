import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import {forceCheck} from 'react-lazyload';
import flatMap from 'lodash/flatMap';

import {t} from 'app/locale';
import space from 'app/styles/space';
import AsyncView from 'app/views/asyncView';
import BetaTag from 'app/components/betaTag';
import {Organization, Release, ProjectRelease} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import PageHeading from 'app/components/pageHeading';
import withOrganization from 'app/utils/withOrganization';
import LoadingIndicator from 'app/components/loadingIndicator';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
// import IntroBanner from 'app/views/releasesV2/list/introBanner';
import {PageContent, PageHeader} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ReleaseCard from 'app/views/releasesV2/list/releaseCard';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'app/constants';

import ReleaseListSortOptions from './releaseListSortOptions';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = AsyncView['state'];

class ReleasesList extends AsyncView<Props, State> {
  shouldReload = true;

  getTitle() {
    return routeTitleGen(t('Releases v2'), this.props.organization.slug, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  getEndpoints(): [string, string, {}][] {
    const {organization, location} = this.props;

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
      summaryStatsPeriod: location.query.statsPeriod,
      per_page: 50,
      health: 1,
      flatten: 1,
    };

    return [['releases', `/organizations/${organization.slug}/releases/`, {query}]];
  }

  componentDidUpdate(prevProps, prevState) {
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

  transformToProjectRelease(releases: Release[]): ProjectRelease[] {
    // native JS flatMap is not supported in our current nodejs 10.16.3 (tests)
    return flatMap(releases, release =>
      release.projects.map(project => {
        return {
          ...release,
          healthData: project.healthData,
          project,
        };
      })
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmptyMessage() {
    const {location} = this.props;
    const searchQuery = this.getQuery();

    if (searchQuery && searchQuery.length) {
      return (
        <EmptyStateWarning small>{`${t(
          'There are no releases that match'
        )}: '${searchQuery}'.`}</EmptyStateWarning>
      );
    }

    if (this.getSort() !== 'date') {
      const relativePeriod = getRelativeSummary(
        location.query.statsPeriod || DEFAULT_STATS_PERIOD
      ).toLowerCase();

      return (
        <EmptyStateWarning small>
          {`${t('There are no releases with data in the')} ${relativePeriod}.`}
        </EmptyStateWarning>
      );
    }

    return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
  }

  renderInnerBody() {
    const {location} = this.props;
    const {loading, releases, reloading} = this.state;

    if ((loading && !reloading) || (loading && !releases?.length)) {
      return <LoadingIndicator />;
    }

    if (!releases.length) {
      return this.renderEmptyMessage();
    }

    const projectReleases = this.transformToProjectRelease(releases);

    return projectReleases.map((release: ProjectRelease) => (
      <ReleaseCard
        key={`${release.version}-${release.project.slug}`}
        release={release}
        project={release.project}
        location={location}
        reloading={reloading}
      />
    ));
  }

  renderBody() {
    const {organization} = this.props;

    return (
      <React.Fragment>
        <GlobalSelectionHeader
          organization={organization}
          showAbsolute={false}
          timeRangeHint={t(
            'Changing this date range will recalculate the release metrics.'
          )}
        />

        <PageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <StyledPageHeader>
              <PageHeading>
                {t('Releases v2')} <BetaTag />
              </PageHeading>
              <SortAndFilterWrapper>
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

            {/* <IntroBanner /> */}

            {this.renderInnerBody()}

            <Pagination pageLinks={this.state.releasesPageLinks} />
          </LightWeightNoProjectMessage>
        </PageContent>
      </React.Fragment>
    );
  }
}

const StyledPageHeader = styled(PageHeader)`
  flex-wrap: wrap;
  margin-bottom: 0;
  ${PageHeading} {
    margin-bottom: ${space(2)};
  }
`;
const SortAndFilterWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    grid-template-columns: none;
    grid-template-rows: 1fr 1fr;
    margin-bottom: ${space(4)};
  }
`;

export default withOrganization(ReleasesList);
export {ReleasesList};
