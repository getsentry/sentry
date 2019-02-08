import React from 'react';
import {Link} from 'react-router';

import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import SentryTypes from 'app/sentryTypes';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import CompactIssue from 'app/components/compactIssue';
import EventUserFeedback from 'app/components/events/userFeedback';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import AsyncView from 'app/views/asyncView';
import {PageContent} from 'app/styles/organization';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import UserFeedbackContainer from './container';
import {getQuery} from './utils';

class OrganizationUserFeedback extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    selection: SentryTypes.GlobalSelection.isRequired,
  };

  getEndpoints() {
    const {organization, location: {search}} = this.props;

    return [
      [
        'reportList',
        `/organizations/${organization.slug}/user-feedback/`,
        {
          query: getQuery(search),
        },
      ],
    ];
  }

  getTitle() {
    return `${t('User Feedback')} - ${this.props.organization.slug}`;
  }

  renderResults() {
    const {orgId} = this.props.params;

    const children = this.state.reportList.map(item => {
      const issue = item.issue;
      return (
        <CompactIssue key={item.id} id={issue.id} data={issue}>
          <EventUserFeedback report={item} orgId={orgId} issueId={issue.id} />
        </CompactIssue>
      );
    });

    return children;
  }

  renderList() {
    if (this.state.reportList.length === 0) {
      return this.renderEmpty();
    }

    return this.renderResults();
  }

  renderIntegrationHint() {
    const {organization, selection} = this.props;

    const allAccessibleProjects = organization.projects.filter(
      project => project.isMember
    );

    const hasSingleProject =
      selection.projects.length === 1 ||
      (selection.projects === 0 && allAccessibleProjects.length === 1);

    if (!hasSingleProject) {
      return null;
    }

    const activeProject = selection.projects.length
      ? allAccessibleProjects.find(
          project => parseInt(project.id, 10) === selection.projects[0]
        )
      : allAccessibleProjects[0];

    const url = `/settings/${organization.slug}/projects/${activeProject.slug}/user-feedback/`;

    return (
      <p>
        <Link to={url}>{t('Learn how to integrate User Feedback')}</Link>
      </p>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no results match your search query.')}</p>
        {this.renderIntegrationHint()}
      </EmptyStateWarning>
    );
  }

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderStreamBody() {
    const {loading, reportList} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!reportList.length) {
      return this.renderEmpty();
    }

    return this.renderResults();
  }

  renderBody() {
    const {organization} = this.props;
    const {location} = this.props;
    const {status} = getQuery(location.search);
    const {reportListPageLinks} = this.state;

    return (
      <Feature
        features={['organizations:sentry10']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <GlobalSelectionHeader organization={organization} />
        <PageContent>
          <NoProjectMessage organization={organization}>
            <UserFeedbackContainer
              pageLinks={reportListPageLinks}
              status={status}
              location={location}
            >
              {this.renderStreamBody()}
            </UserFeedbackContainer>
          </NoProjectMessage>
        </PageContent>
      </Feature>
    );
  }
}

export {OrganizationUserFeedback};
export default withOrganization(withGlobalSelection(OrganizationUserFeedback));
