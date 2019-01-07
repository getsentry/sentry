import React from 'react';

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
import AsyncView from 'app/views/asyncView';
import {PageContent} from 'app/styles/organization';

import UserFeedbackContainer from './container';
import {getQuery} from './utils';

class OrganizationUserFeedback extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
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
      const projectId = issue.project.slug;
      return (
        <CompactIssue
          key={item.id}
          id={issue.id}
          data={issue}
          orgId={orgId}
          projectId={projectId}
        >
          <EventUserFeedback
            report={item}
            orgId={orgId}
            projectId={projectId}
            issueId={issue.id}
          />
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

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no results match your search query.')}</p>
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
    const {location, params} = this.props;
    const {status} = getQuery(location.search);
    const {reportList, reportListPageLinks} = this.state;

    if (this.state.loading) {
      return <LoadingIndicator />;
    }

    return (
      <UserFeedbackContainer
        pageLinks={reportListPageLinks}
        status={status}
        location={location}
        params={params}
      >
        {reportList.length ? this.renderResults() : this.renderEmpty()}
      </UserFeedbackContainer>
    );
  }

  renderBody() {
    const {organization} = this.props;

    return (
      <Feature
        features={['organizations:sentry10']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <GlobalSelectionHeader organization={organization} />
        <PageContent>{this.renderStreamBody()}</PageContent>
      </Feature>
    );
  }
}

export {OrganizationUserFeedback};
export default withOrganization(OrganizationUserFeedback);
