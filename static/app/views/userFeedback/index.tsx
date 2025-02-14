import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import omit from 'lodash/omit';

import {LinkButton} from 'sentry/components/button';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import CompactIssue from 'sentry/components/issues/compactIssue';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
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
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UserReport} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFeedbackPathname} from 'sentry/views/userFeedback/pathnames';

import {UserFeedbackEmpty} from './userFeedbackEmpty';
import {getQuery} from './utils';

interface Props extends RouteComponentProps {}

function OrganizationUserFeedback({location: {search, pathname, query}, router}: Props) {
  const organization = useOrganization();
  const {status} = getQuery(search);

  const unresolvedQuery = omit(query, 'status');
  const allIssuesQuery = {...query, status: ''};
  const hasNewFeedback = organization.features.includes('user-feedback-ui');

  const {
    data: reportList,
    isPending,
    isError,
    getResponseHeader,
  } = useApiQuery<UserReport[]>(
    [
      `/organizations/${organization.slug}/user-feedback/`,
      {
        query: getQuery(search),
      },
    ],
    {staleTime: 0}
  );

  const reportListsPageLinks = getResponseHeader?.('Link');

  function getProjectIds() {
    const {project} = query;

    return Array.isArray(project)
      ? project
      : typeof project === 'string'
        ? [project]
        : [];
  }

  function StreamBody() {
    if (isError) {
      return <LoadingError />;
    }
    if (isPending) {
      return (
        <Panel>
          <LoadingIndicator />
        </Panel>
      );
    }
    if (!reportList?.length) {
      return <UserFeedbackEmpty projectIds={getProjectIds()} issueTab={false} />;
    }
    return (
      <Panel className="issue-list" data-test-id="user-feedback-list">
        {reportList.map(item => {
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

  return (
    <SentryDocumentTitle title={`${t('User Feedback')} - ${organization.slug}`}>
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
                  <LinkButton
                    size="sm"
                    priority="default"
                    to={{
                      pathname: makeFeedbackPathname({
                        path: '/',
                        organization,
                      }),
                      query: {
                        ...query,
                        query: undefined,
                        cursor: undefined,
                      },
                    }}
                  >
                    {t('Go to New User Feedback')}
                  </LinkButton>
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
              <StreamBody />
              <Pagination pageLinks={reportListsPageLinks} />
            </Layout.Main>
          </Layout.Body>
        </NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default withProfiler(OrganizationUserFeedback);

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
