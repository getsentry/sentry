import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import SentryTypes from 'app/sentryTypes';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import CompactIssue from 'app/components/compactIssue';
import EventUserFeedback from 'app/components/events/userFeedback';
import space from 'app/styles/space';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import AsyncView from 'app/views/asyncView';

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
      <Content>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Content>
    );
  }

  renderBody() {
    const {organization, location, params} = this.props;
    const {status} = getQuery(location.search);
    const {reportList, reportListPageLinks} = this.state;

    return (
      <Feature
        features={['organizations:sentry10']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <GlobalSelectionHeader
          organization={organization}
          projects={organization.projects.filter(project => project.isMember)}
          showAbsolute={true}
          showRelative={true}
        />
        <Content>
          <UserFeedbackContainer
            pageLinks={reportListPageLinks}
            status={status}
            location={location}
            params={params}
          >
            {reportList.length ? this.renderResults() : this.renderEmpty()}
          </UserFeedbackContainer>
        </Content>
      </Feature>
    );
  }
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: ${space(2)} ${space(4)} ${space(3)};
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;

export {OrganizationUserFeedback};
export default withOrganization(OrganizationUserFeedback);
