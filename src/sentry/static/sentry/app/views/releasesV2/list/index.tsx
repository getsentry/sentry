import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';

import {t} from 'app/locale';
import {Organization, Release} from 'app/types';
import AsyncView from 'app/views/asyncView';
import BetaTag from 'app/components/betaTag';
import routeTitleGen from 'app/utils/routeTitle';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import PageHeading from 'app/components/pageHeading';
import {getQuery} from 'app/views/releases/list/utils';
import withOrganization from 'app/utils/withOrganization';
import LoadingIndicator from 'app/components/loadingIndicator';
import NoProjectMessage from 'app/components/noProjectMessage';
import IntroBanner from 'app/views/releasesV2/list/introBanner';
import {PageContent, PageHeader} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ReleaseCard from 'app/views/releasesV2/list/releaseCard';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Projects from 'app/utils/projects';

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
    return [
      [
        'releases',
        `/organizations/${organization.slug}/releases/`,
        {query: getQuery(location.query)},
      ],
    ];
  }

  handleReleaseSearch = (query: string) => {
    const {location, router, params} = this.props;

    router.push({
      pathname: `/organizations/${params.orgId}/releases-v2/`,
      query: {...location.query, query},
    });
  };

  renderLoading() {
    return this.renderBody();
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

    const projectSlugs: string[] = uniq(
      flatten(releases.map((r: Release) => r.projects.map(p => p.slug)))
    );

    return (
      <Projects orgId={organization.slug} slugs={projectSlugs}>
        {({projects}) =>
          releases.map((release: Release) => (
            <ReleaseCard
              key={release.version}
              release={release}
              projects={projects.filter(project =>
                release.projects.map(p => p.slug).includes(project.slug)
              )}
            />
          ))
        }
      </Projects>
    );
  }

  renderBody() {
    const {organization, location} = this.props;

    return (
      <React.Fragment>
        <GlobalSelectionHeader organization={organization} />

        <NoProjectMessage organization={organization}>
          <PageContent>
            <PageHeader>
              <PageHeading>
                {t('Releases v2')} <BetaTag />
              </PageHeading>
              <SearchBar
                placeholder={t('Search for a release')}
                onSearch={this.handleReleaseSearch}
                defaultQuery={
                  typeof location.query.query === 'string' ? location.query.query : ''
                }
              />
            </PageHeader>

            <IntroBanner />

            {this.renderInnerBody()}

            <Pagination pageLinks={this.state.releasesPageLinks} />
          </PageContent>
        </NoProjectMessage>
      </React.Fragment>
    );
  }
}

export default withOrganization(ReleasesList);
export {ReleasesList};
