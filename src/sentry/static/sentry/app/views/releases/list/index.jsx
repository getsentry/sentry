import {browserHistory} from 'react-router';
import React from 'react';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';

import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LoadingIndicator from 'app/components/loadingIndicator';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import SentryTypes from 'app/sentryTypes';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import Feature from 'app/components/acl/feature';
import SwitchReleasesButton from 'app/views/releasesV2/utils/switchReleasesButton';
import {defined} from 'app/utils';
import space from 'app/styles/space';

import {getQuery} from './utils';
import ReleaseLanding from './releaseLanding';
import ReleaseList from './releaseList';
import ReleaseListHeader from './releaseListHeader';
import ReleaseProgress from './releaseProgress';

const ReleasesContainer = props => {
  return (
    <React.Fragment>
      <GlobalSelectionHeader>
        <OrganizationReleases {...props} />
      </GlobalSelectionHeader>
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
    const {query} = location;

    const allowedQuery = getQuery(query);
    if (!defined(query.start) && !defined(query.end)) {
      // send 14d as default to api
      allowedQuery.statsPeriod = query.statsPeriod || '14d';
    }

    return [
      [
        'releaseList',
        `/organizations/${organization.slug}/releases/`,
        {query: allowedQuery},
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

    if (!projects) {
      return true;
    }

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
    const allAccessibleProjects = organization?.projects?.filter(
      project => project.hasAccess
    );

    if (!allAccessibleProjects) {
      return null;
    }

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
        <LightWeightNoProjectMessage organization={organization}>
          <PageHeader>
            <PageHeading>{t('Releases')}</PageHeading>
            <Wrapper>
              <Feature features={['releases-v2']} organization={organization}>
                <SwitchReleasesButton version="2" orgId={organization.id} />
              </Feature>
              <SearchBar
                defaultQuery=""
                placeholder={t('Search for a release')}
                query={location.query.query}
                onSearch={this.onSearch}
              />
            </Wrapper>
          </PageHeader>
          <div>
            <Panel>
              <ReleaseListHeader />
              <PanelBody>{this.renderStreamBody()}</PanelBody>
            </Panel>
            <Pagination pageLinks={this.state.releaseListPageLinks} />
          </div>
        </LightWeightNoProjectMessage>
      </PageContent>
    );
  }
}

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  margin-left: ${space(2)};
  grid-template-columns: auto auto;
`;

export default withOrganization(withGlobalSelection(withProfiler(ReleasesContainer)));
