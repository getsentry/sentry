import {Link} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import omit from 'lodash/omit';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';

import {Organization, UserReport} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import CompactIssue from 'app/components/issues/compactIssue';
import EventUserFeedback from 'app/components/events/userFeedback';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import {getQuery} from './utils';
import UserFeedbackEmpty from './userFeedbackEmpty';

type State = AsyncView['state'] & {
  reportList: UserReport[];
};

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
};

class OrganizationUserFeedback extends AsyncView<Props, State> {
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
    const {pathname, search, query} = location;
    const {status} = getQuery(search);
    const {reportListPageLinks} = this.state;

    const unresolvedQuery = omit(query, 'status');
    const allIssuesQuery = {...query, status: ''};

    return (
      <GlobalSelectionHeader>
        <PageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <div data-test-id="user-feedback">
              <Header>
                <PageHeading>{t('User Feedback')}</PageHeading>
                <div className="btn-group">
                  <Link
                    to={{pathname, query: unresolvedQuery}}
                    className={
                      'btn btn-sm btn-default' +
                      (status === 'unresolved' ? ' active' : '')
                    }
                  >
                    {t('Unresolved')}
                  </Link>
                  <Link
                    to={{pathname, query: allIssuesQuery}}
                    className={
                      'btn btn-sm btn-default' + (status === '' ? ' active' : '')
                    }
                  >
                    {t('All Issues')}
                  </Link>
                </div>
              </Header>
              <Panel>
                <PanelBody className="issue-list">{this.renderStreamBody()}</PanelBody>
              </Panel>
              <Pagination pageLinks={reportListPageLinks} />
            </div>
          </LightWeightNoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
    );
  }
}

export default withOrganization(withProfiler(OrganizationUserFeedback));

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const StyledEventUserFeedback = styled(EventUserFeedback)`
  margin: ${space(2)} 0 0;
`;
