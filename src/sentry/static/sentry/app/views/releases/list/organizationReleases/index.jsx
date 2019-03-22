import React from 'react';
import {browserHistory} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import SearchBar from 'app/components/searchBar';
import {Panel, PanelBody} from 'app/components/panels';
import Pagination from 'app/components/pagination';
import LoadingIndicator from 'app/components/loadingIndicator';
import Alert from 'app/components/alert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import AsyncView from 'app/views/asyncView';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';

import ReleaseList from '../shared/releaseList';
import ReleaseListHeader from '../shared/releaseListHeader';
import ReleaseLanding from '../shared/releaseLanding';
import ReleaseProgress from '../shared/releaseProgress';
import {getQuery} from '../shared/utils';

class OrganizationReleasesContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    selection: SentryTypes.GlobalSelection.isRequired,
  };

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    const {organization} = this.props;
    return (
      <Feature
        features={['organizations:sentry10']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <GlobalSelectionHeader organization={organization} />
        <OrganizationReleases {...this.props} />
      </Feature>
    );
  }
}

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
    const targetQueryParams = {};
    if (query !== '') {
      targetQueryParams.query = query;
    }

    const {orgId} = this.props.params;
    browserHistory.push({
      pathname: `/organizations/${orgId}/releases/`,
      query: targetQueryParams,
    });
  };

  // Returns true if there has been a release in any selected project, otherwise false
  hasAnyRelease() {
    const {organization: {projects}, selection} = this.props;
    const projectIds = new Set(selection.projects);
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

    const releaseProject = selection.projects.length
      ? allAccessibleProjects.find(
          project => parseInt(project.id, 10) === selection.projects[0]
        )
      : allAccessibleProjects[0];

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

export default withOrganization(withGlobalSelection(OrganizationReleasesContainer));
