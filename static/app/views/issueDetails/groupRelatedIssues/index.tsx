// XXX: A lot of the UI for this file will be changed once we use IssueListActions
// We're using GroupList to help us iterate quickly
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import GroupList from 'sentry/components/issues/groupList';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type RouteParams = {
  groupId: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

type RelatedIssuesResponse = {
  data: [
    {
      data: number[];
      meta: {
        event_id: string;
        trace_id: string;
      };
      type: string;
    },
  ];
};

function GroupRelatedIssues({params}: Props) {
  const {groupId} = params;

  const organization = useOrganization();
  const orgSlug = organization.slug;

  // Fetch the list of related issues
  const {
    isLoading,
    isError,
    data: relatedIssues,
    refetch,
  } = useApiQuery<RelatedIssuesResponse>([`/issues/${groupId}/related-issues/`], {
    staleTime: 0,
  });

  let traceMeta = {
    trace_id: '',
    event_id: '',
  };
  const {
    same_root_cause: sameRootCauseIssues = [],
    trace_connected: traceConnectedIssues = [],
  } = (relatedIssues?.data ?? []).reduce(
    (mapping, item) => {
      if (item.type === 'trace_connected') {
        traceMeta = {...item.meta};
      }
      // If the group we're looking related issues for shows up in the table,
      // it will trigger a bug in getGroupReprocessingStatus because activites would be empty,
      // thus, we excude it from the list of related issues
      const issuesList = item.data.filter(id => id.toString() !== groupId);
      mapping[item.type] = issuesList;
      return mapping;
    },
    {same_root_cause: [], trace_connected: []}
  );

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <HeaderWrapper>
          <small>
            {t(
              'Related Issues are issues that are related in some way and can be acted on together.'
            )}
          </small>
        </HeaderWrapper>
        {isLoading ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError
            message={t('Unable to load related issues, please try again later')}
            onRetry={refetch}
          />
        ) : (
          <div>
            <div>
              <HeaderWrapper>
                <Title>{t('Issues caused by the same root cause')}</Title>
                {sameRootCauseIssues.length > 0 ? (
                  <GroupList
                    orgSlug={orgSlug}
                    query={`issue.id:[${sameRootCauseIssues}]`}
                    source="related-issues-tab"
                    withColumns={['event', 'assignee']}
                  />
                ) : (
                  <small>{t('No same-root-cause related issues were found.')}</small>
                )}
              </HeaderWrapper>
            </div>
            <div>
              <HeaderWrapper>
                <Title>{t('Trace connected issues')}</Title>
                {traceConnectedIssues.length > 0 ? (
                  <div>
                    <small>
                      {t('These are the issues belonging to ')}
                      <Link
                        to={`/performance/trace/${traceMeta.trace_id}/?node=error-${traceMeta.event_id}`}
                      >
                        {t('this trace')}
                      </Link>
                    </small>
                    <GroupList
                      orgSlug={orgSlug}
                      query={`issue.id:[${traceConnectedIssues}]`}
                      source="related-issues-tab"
                      withColumns={['event', 'assignee']}
                    />
                  </div>
                ) : (
                  <small>{t('No trace-connected related issues were found.')}</small>
                )}
              </HeaderWrapper>
            </div>
          </div>
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

function GroupRelatedIssuesWrapper(props: Props) {
  return (
    <Feature features={['related-issues']}>
      <GroupRelatedIssues {...props} />
    </Feature>
  );
}

// Export the component without feature flag controls
export {GroupRelatedIssues};
export default GroupRelatedIssuesWrapper;

const Title = styled('h4')`
  margin-bottom: ${space(0.75)};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;
