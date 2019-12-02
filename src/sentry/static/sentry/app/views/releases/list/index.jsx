import {browserHistory} from 'react-router';
import React from 'react';

import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LoadingIndicator from 'app/components/loadingIndicator';
import NoProjectMessage from 'app/components/noProjectMessage';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import SentryTypes from 'app/sentryTypes';
import profiler from 'app/utils/profiler';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import {getQuery} from './utils';
import ReleaseLanding from './releaseLanding';
import ReleaseList from './releaseList';
import ReleaseListHeader from './releaseListHeader';
import ReleaseProgress from './releaseProgress';

const ReleasesContainer = props => {
  const {organization} = props;
  return (
    <React.Fragment>
      <GlobalSelectionHeader organization={organization} />
      <OrganizationReleases {...props} />
    </React.Fragment>
  );
};
ReleasesContainer.propTypes = {
  organization: SentryTypes.Organization.isRequired,
  selection: SentryTypes.GlobalSelection.isRequired,
};

class OrganizationReleases extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  getTitle() {
    return `${t('Releases')} - ${this.props.organization.slug}`;
  }

  getEndpoints() {
    const {organization, location} = this.props;
    return [
      [
        'releaseList',
        `/organizations/${organization.slug}/releases/`,
        {query: getQuery(location.query)},
      ],
    ];
  }

  onSearch = query => {
    const targetQueryParams = getQuery(this.props.location).query;
    targetQueryParams.query = query;

    const {orgId} = this.props.params;
    browserHistory.push({
      pathname: `/organizations/${orgId}/releases/`,
      query: targetQueryParams,
    });
  };

  // Returns true if there has been a release in any selected project, otherwise false
  hasAnyRelease() {
    const {
      organization: {projects},
      selection,
    } = this.props;

    const projectIds = new Set(
      selection.projects.length > 0
        ? selection.projects
        : projects.filter(p => p.isMember).map(p => parseInt(p.id, 10))
    );

    const activeProjects = projects.filter(project =>
      projectIds.has(parseInt(project.id, 10))
    );
    return activeProjects.some(project => !!project.latestRelease);
  }

  renderStreamBody() {
    const {organization} = this.props;
    const {loading, releaseList} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (releaseList.length === 0) {
      return this.hasAnyRelease() ? this.renderNoQueryResults() : this.renderLanding();
    }

    return (
      <React.Fragment>
        {this.renderReleaseProgress()}
        <ReleaseList releaseList={releaseList} orgId={organization.slug} />
      </React.Fragment>
    );
  }

  renderReleaseProgress() {
    const {organization, selection} = this.props;
    const allAccessibleProjects = organization.projects.filter(
      project => project.hasAccess
    );

    const hasSingleProject =
      selection.projects.length === 1 ||
      (selection.projects.length === 0 && allAccessibleProjects.length === 1);

    if (!hasSingleProject) {
      return null;
    }

    let releaseProject = allAccessibleProjects[0];
    // Don't look for meta values which have named values
    if (selection.projects.length && selection.projects[0] !== ALL_ACCESS_PROJECTS) {
      releaseProject = allAccessibleProjects.find(
        project => parseInt(project.id, 10) === selection.projects[0]
      );
    }

    return <ReleaseProgress project={releaseProject} />;
  }

  renderNoQueryResults() {
    return (
      <React.Fragment>
        {this.renderReleaseProgress()}
        <EmptyStateWarning>
          <p>{t('Sorry, no releases match your filters.')}</p>
        </EmptyStateWarning>
      </React.Fragment>
    );
  }

  renderLanding() {
    return <ReleaseLanding />;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {location, organization} = this.props;

    return (
      <PageContent>
        <NoProjectMessage organization={organization}>
          <PageHeader>
            <PageHeading>{t('Releases')}</PageHeading>
            <div>
              <SearchBar
                defaultQuery=""
                placeholder={t('Search for a release')}
                query={location.query.query}
                onSearch={this.onSearch}
              />
            </div>
          </PageHeader>
          <div>
            <Panel>
              <ReleaseListHeader />
              <PanelBody>{this.renderStreamBody()}</PanelBody>
            </Panel>
            <Pagination pageLinks={this.state.releaseListPageLinks} />
          </div>
        </NoProjectMessage>
      </PageContent>
    );
  }
}

export default withOrganization(withGlobalSelection(profiler()(ReleasesContainer)));
