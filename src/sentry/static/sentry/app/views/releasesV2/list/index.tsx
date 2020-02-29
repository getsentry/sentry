import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

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
import NoProjectMessage from 'app/components/noProjectMessage';
import IntroBanner from 'app/views/releasesV2/list/introBanner';
import {PageContent, PageHeader} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ReleaseCard from 'app/views/releasesV2/list/releaseCard';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Projects from 'app/utils/projects';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';

import ReleaseListSortOptions from './releaseListSortOptions';

type Props = {
  params: Params;
  location: Location;
  organization: Organization;
  router: ReactRouter.InjectedRouter;
} & AsyncView['props'];

type State = AsyncView['state'];

class ReleasesList extends AsyncView<Props, State> {
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
      ...pick(location.query, [...Object.values(URL_PARAM), 'cursor', 'query', 'sort']),
      per_page: 50,
      health: 1,
    };

    return [['releases', `/organizations/${organization.slug}/releases/`, {query}]];
  }

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getSort() {
    const {sort} = this.props.location.query;

    return typeof sort === 'string' ? sort : undefined;
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

  renderLoading() {
    return this.renderBody();
  }

  transformToProjectRelease(releases: Release[]): ProjectRelease[] {
    return releases.flatMap(release => {
      return release.projects.map(project => {
        const {
          version,
          dateCreated,
          dateReleased,
          commitCount,
          authors,
          lastEvent,
          newGroups,
        } = release;
        const {slug, healthData} = project;
        return {
          version,
          dateCreated,
          dateReleased,
          commitCount,
          authors,
          lastEvent,
          newGroups,
          healthData: healthData!,
          projectSlug: slug,
          // TODO(releasesv2): make api send also project platform
        };
      });
    });
  }

  renderInnerBody() {
    const {organization} = this.props;
    const {loading, releases} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!releases.length) {
      return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
    }

    const projectReleases = this.transformToProjectRelease(releases);

    return (
      <Projects orgId={organization.slug} slugs={projectReleases.map(r => r.projectSlug)}>
        {({projects}) =>
          projectReleases.map((release: ProjectRelease) => (
            <ReleaseCard
              key={`${release.version}-${release.dateCreated}`}
              release={release}
              project={projects.find(p => p.slug === release.projectSlug)}
            />
          ))
        }
      </Projects>
    );
  }

  renderBody() {
    const {organization} = this.props;

    return (
      <React.Fragment>
        <GlobalSelectionHeader organization={organization} />

        <NoProjectMessage organization={organization}>
          <PageContent>
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
                  defaultQuery={this.getQuery()}
                />
              </SortAndFilterWrapper>
            </StyledPageHeader>

            <IntroBanner />

            {this.renderInnerBody()}

            <Pagination pageLinks={this.state.releasesPageLinks} />
          </PageContent>
        </NoProjectMessage>
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
  grid-column-gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

export default withOrganization(ReleasesList);
export {ReleasesList};
