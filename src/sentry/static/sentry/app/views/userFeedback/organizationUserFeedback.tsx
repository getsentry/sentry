import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from 'react-emotion';

import {PageContent} from 'app/styles/organization';
import {Organization, UserReport} from 'app/types';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import CompactIssue from 'app/components/issues/compactIssue';
import EventUserFeedback from 'app/components/events/userFeedback';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LoadingIndicator from 'app/components/loadingIndicator';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import UserFeedbackContainer from './container';
import UserFeedbackEmpty from './userFeedbackEmpty';
import {getQuery} from './utils';

type State = AsyncView['state'] & {
  reportList: UserReport[];
};

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
};

class OrganizationUserFeedback extends AsyncView<Props, State> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  getEndpoints(): [string, string, any][] {
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

  get projectIds() {
    const {project} = this.props.location.query;

    return Array.isArray(project)
      ? project
      : typeof project === 'string'
      ? [project]
      : [];
  }

  renderResults() {
    const {orgId} = this.props.params;

    return (
      <div data-test-id="user-feedback-list">
        {this.state.reportList.map(item => {
          const issue = item.issue;
          return (
            <CompactIssue key={item.id} id={issue.id} data={issue} eventId={item.eventID}>
              <StyledEventUserFeedback report={item} orgId={orgId} issueId={issue.id} />
            </CompactIssue>
          );
        })}
      </div>
    );
  }

  renderEmpty() {
    return <UserFeedbackEmpty projectIds={this.projectIds} />;
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
          <LightWeightNoProjectMessage organization={organization}>
            <UserFeedbackContainer
              pageLinks={reportListPageLinks}
              status={status}
              location={location}
            >
              {this.renderStreamBody()}
            </UserFeedbackContainer>
          </LightWeightNoProjectMessage>
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
