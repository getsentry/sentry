import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import omit from 'lodash/omit';

import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import EventUserFeedback from 'sentry/components/events/userFeedback';
import CompactIssue from 'sentry/components/issues/compactIssue';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization, UserReport} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import UserFeedbackEmpty from './userFeedbackEmpty';
import {getQuery} from './utils';

type State = AsyncView['state'] & {
  reportList: UserReport[];
};

type Props = RouteComponentProps<{orgId: string}, {}> & {
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
    const {orgId} = this.props.params;

    return (
      <Panel className="issue-list" data-test-id="user-feedback-list">
        {this.state.reportList.map(item => {
          const issue = item.issue;
          return (
            <CompactIssue key={item.id} id={issue.id} data={issue} eventId={item.eventID}>
              <StyledEventUserFeedback report={item} orgId={orgId} issueId={issue.id} />
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
    const {organization} = this.props;
    const {location} = this.props;
    const {pathname, search, query} = location;
    const {status} = getQuery(search);
    const {reportListPageLinks} = this.state;

    const unresolvedQuery = omit(query, 'status');
    const allIssuesQuery = {...query, status: ''};

    const hasNewPageFilters = organization.features.includes('selection-filters-v2');

    return (
      <PageFiltersContainer hideGlobalHeader={hasNewPageFilters}>
        <PageContent>
          <NoProjectMessage organization={organization}>
            <div data-test-id="user-feedback">
              <Header>
                <PageHeading>{t('User Feedback')}</PageHeading>
                {!hasNewPageFilters && (
                  <ButtonBar active={!Array.isArray(status) ? status || '' : ''} merged>
                    <Button barId="unresolved" to={{pathname, query: unresolvedQuery}}>
                      {t('Unresolved')}
                    </Button>
                    <Button barId="" to={{pathname, query: allIssuesQuery}}>
                      {t('All Issues')}
                    </Button>
                  </ButtonBar>
                )}
              </Header>
              <Feature
                organization={organization}
                features={['organizations:selection-filters-v2']}
              >
                <Filters>
                  <ButtonBar active={!Array.isArray(status) ? status || '' : ''} merged>
                    <Button barId="unresolved" to={{pathname, query: unresolvedQuery}}>
                      {t('Unresolved')}
                    </Button>
                    <Button barId="" to={{pathname, query: allIssuesQuery}}>
                      {t('All Issues')}
                    </Button>
                  </ButtonBar>
                  <PageFilterBar>
                    <ProjectPageFilter />
                    <EnvironmentPageFilter />
                    <DatePageFilter hidePin alignDropdown="right" />
                  </PageFilterBar>
                </Filters>
              </Feature>
              {this.renderStreamBody()}
              <Pagination pageLinks={reportListPageLinks} />
            </div>
          </NoProjectMessage>
        </PageContent>
      </PageFiltersContainer>
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

const Filters = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  justify-content: start;
  gap: ${space(1)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: max-content minmax(0, 1fr);
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledEventUserFeedback = styled(EventUserFeedback)`
  margin: ${space(2)} 0 0;
`;
