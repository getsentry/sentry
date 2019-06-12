import React from 'react';
import styled from 'react-emotion';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import CompactIssue from 'app/components/issues/compactIssue';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventUserFeedback from 'app/components/events/userFeedback';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LoadingIndicator from 'app/components/loadingIndicator';
import NoProjectMessage from 'app/components/noProjectMessage';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import UserFeedbackContainer from './container';
import {getQuery} from './utils';

class OrganizationUserFeedback extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  getEndpoints() {
    const {
      organization,
      location: {search},
    } = this.props;

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

    return (
      <div data-test-id="user-feedback-list">
        {this.state.reportList.map(item => {
          const issue = item.issue;
          return (
            <CompactIssue
              key={item.id}
              id={issue.id}
              data={issue}
              eventId={item.event.eventID}
            >
              <StyledEventUserFeedback report={item} orgId={orgId} issueId={issue.id} />
            </CompactIssue>
          );
        })}
      </div>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no results match your search query.')}</p>
      </EmptyStateWarning>
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
      <React.Fragment>
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
      </React.Fragment>
    );
  }
}

export {OrganizationUserFeedback};
export default withOrganization(OrganizationUserFeedback);

const StyledEventUserFeedback = styled(EventUserFeedback)`
  margin: ${space(2)} 0 0;
`;
