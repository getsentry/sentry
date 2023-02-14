import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import omit from 'lodash/omit';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import CompactIssue from 'sentry/components/issues/compactIssue';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, UserReport} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import {UserFeedbackEmpty} from './userFeedbackEmpty';
import {getQuery} from './utils';

type State = AsyncView['state'] & {
  reportList: UserReport[];
};

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
};

class OrganizationUserFeedback extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
    const {organization} = this.props;

    return (
      <Panel className="issue-list" data-test-id="user-feedback-list">
        {this.state.reportList.map(item => {
          const issue = item.issue;
          return (
            <CompactIssue key={item.id} id={issue.id} data={issue} eventId={item.eventID}>
              <StyledEventUserFeedback
                report={item}
                orgId={organization.slug}
                issueId={issue.id}
              />
            </CompactIssue>
          );
        })}
      </Panel>
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
      return (
        <Panel>
          <LoadingIndicator />
        </Panel>
      );
    }

    if (!reportList.length) {
      return this.renderEmpty();
    }

    return this.renderResults();
  }

  renderBody() {
    const {organization, router} = this.props;
    const {location} = this.props;
    const {pathname, search, query} = location;
    const {status} = getQuery(search);
    const {reportListPageLinks} = this.state;

    const unresolvedQuery = omit(query, 'status');
    const allIssuesQuery = {...query, status: ''};

    return (
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('User Feedback')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io/product/user-feedback/"
                  title={t(
                    'Feedback submitted by users who experienced an error while using your application, including their name, email address, and any additional comments.'
                  )}
                />
              </Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <Layout.Body data-test-id="user-feedback">
            <Layout.Main fullWidth>
              <Filters>
                <PageFilterBar>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter alignDropdown="right" />
                </PageFilterBar>
                <SegmentedControl
                  aria-label={t('Issue Status')}
                  value={!Array.isArray(status) ? status || '' : ''}
                  onChange={key =>
                    router.replace({
                      pathname,
                      query: key === 'unresolved' ? unresolvedQuery : allIssuesQuery,
                    })
                  }
                >
                  <SegmentedControl.Item key="unresolved">
                    {t('Unresolved')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="">{t('All Issues')}</SegmentedControl.Item>
                </SegmentedControl>
              </Filters>
              {this.renderStreamBody()}
              <Pagination pageLinks={reportListPageLinks} />
            </Layout.Main>
          </Layout.Body>
        </NoProjectMessage>
      </PageFiltersContainer>
    );
  }
}

export default withOrganization(withProfiler(OrganizationUserFeedback));

const Filters = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, max-content) max-content;
  justify-content: start;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: minmax(0, 1fr) max-content;
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledEventUserFeedback = styled(EventUserFeedback)`
  margin: ${space(2)} 0;
`;
