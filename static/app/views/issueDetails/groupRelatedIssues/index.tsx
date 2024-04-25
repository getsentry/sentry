// XXX: A lot of the UI for this file will be changed once we use IssueListActions
// We're using GroupList to help us iterate quickly
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import GroupList from 'sentry/components/issues/groupList';
import * as Layout from 'sentry/components/layouts/thirds';
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

  // If the group we're looking related issues for shows up in the table,
  // it will trigger a bug in getGroupReprocessingStatus because activites would be empty,
  // thus, we excude it from the list of related issues
  const sameRootCauseIssues = relatedIssues?.data
    .filter(item => item.type === 'same_root_cause')
    .map(item => item.data)
    .filter(id => id.toString() !== groupId)
    ?.join(',');
  const traceConnectedIssues = relatedIssues?.data
    .filter(item => item.type === 'trace_connected')
    .map(item => item.data)
    .filter(id => id.toString() !== groupId)
    ?.join(',');

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <HeaderWrapper>
          <Title>{t('Related Issues')}</Title>
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
        ) : sameRootCauseIssues || traceConnectedIssues ? (
          <div>
            {sameRootCauseIssues ? (
              <div>
                <Title>{t('Issues caused by the same root')}</Title>
                <GroupList
                  endpointPath={`/organizations/${orgSlug}/issues/`}
                  orgSlug={orgSlug}
                  queryParams={{query: `issue.id:[${sameRootCauseIssues}]`}}
                  query=""
                  source="related-issues-tab"
                  renderEmptyMessage={() => (
                    <Title>No issues caused by the same root.</Title>
                  )}
                  renderErrorMessage={() => <Title>Error loading related issues</Title>}
                />
              </div>
            ) : null}
            {traceConnectedIssues ? (
              <div>
                <Title>{t('Issues that happened within the same trace')}</Title>
                <GroupList
                  endpointPath={`/organizations/${orgSlug}/issues/`}
                  orgSlug={orgSlug}
                  queryParams={{query: `issue.id:[${traceConnectedIssues}]`}}
                  query=""
                  source="related-issues-tab"
                  renderEmptyMessage={() => (
                    <Title>No issues caused by the same root.</Title>
                  )}
                  renderErrorMessage={() => <Title>Error loading related issues</Title>}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <b>No related issues found!</b>
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
