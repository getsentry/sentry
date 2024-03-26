// XXX: A lot of the UI for this file will be changed once we use IssueListActions
// We're using GroupList to help us iterate quickly
import {Fragment} from 'react';
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

type RouteParams = {
  groupId: string;
  orgId: string; // XXX: Find caller and rename from orgId to orgSlug
};

type Props = RouteComponentProps<RouteParams, {}>;

type RelatedIssuesResponse = {
  same_root_cause: number[];
};

function GroupRelatedIssues({params}: Props) {
  const {groupId, orgId} = params;

  // Fetch the list of related issues
  const {
    isLoading,
    isError,
    data: relatedIssues,
    refetch,
  } = useApiQuery<RelatedIssuesResponse>([`/issues/${groupId}/related-issues/`], {
    staleTime: 0,
  });

  const groups = relatedIssues?.same_root_cause?.join(',');

  return (
    <Feature features={['related-issues']}>
      <Fragment>
        <Layout.Body>
          <Layout.Main fullWidth>
            <HeaderWrapper>
              <Title>{t('Related Issues')}</Title>
              <small>
                {t(
                  'Related Issues are issues that may have the same root cause and can be acted on together.'
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
            ) : groups ? (
              <GroupList
                endpointPath={`/organizations/${orgId}/issues/`}
                orgSlug={orgId}
                queryParams={{}}
                query={`issue.id:${groups}`}
                source="related-issues-tab"
                renderEmptyMessage={() => <hr />}
                renderErrorMessage={() => <hr />}
              />
            ) : null}
          </Layout.Main>
        </Layout.Body>
      </Fragment>
    </Feature>
  );
}

export default GroupRelatedIssues;

const Title = styled('h4')`
  margin-bottom: ${space(0.75)};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;
