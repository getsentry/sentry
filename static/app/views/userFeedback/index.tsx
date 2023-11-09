import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import omit from 'lodash/omit';

import {Button} from 'sentry/components/button';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import CompactIssue from 'sentry/components/issues/compactIssue';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, UserReport} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView, {AsyncViewState} from 'sentry/views/deprecatedAsyncView';

import {UserFeedbackEmpty} from './userFeedbackEmpty';
import {getQuery} from './utils';

interface State extends AsyncViewState {
  reportList: UserReport[];
}

interface Props extends RouteComponentProps<{}, {}> {
  organization: Organization;
}

class OrganizationUserFeedback extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
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
                orgSlug={organization.slug}
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
    const hasNewFeedback = organization.features.includes('user-feedback-ui');

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
            {hasNewFeedback && (
              <Layout.HeaderActions>
                <Tooltip
                  title={t('Go back to the new feedback layout.')}
                  position="left"
                  isHoverable
                >
                  <Button
                    size="sm"
                    priority="default"
                    to={{
                      pathname: normalizeUrl(
                        `/organizations/${organization.slug}/feedback/`
                      ),
                      query: {
                        ...location.query,
                        query: undefined,
                        cursor: undefined,
                      },
                    }}
                  >
                    {t('Go to New User Feedback')}
                  </Button>
                </Tooltip>
              </Layout.HeaderActions>
            )}
          </Layout.Header>
          <Layout.Body data-test-id="user-feedback">
            <Layout.Main fullWidth>
              <Filters>
                <PageFilterBar>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter position="bottom-end" />
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
