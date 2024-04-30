// XXX: A lot of the UI for this file will be changed once we use IssueListActions
// We're using GroupList to help us iterate quickly
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {LinkButton} from 'sentry/components/button';
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
      const issuesList = item.data;
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
                  <div>
                    <TextButtonWrapper>
                      <div />
                      <LinkButton
                        href={`/issues/?query=issue.id:[${groupId},${sameRootCauseIssues}]`}
                        size="xs"
                        external
                      >
                        {t('Open in Issues')}
                      </LinkButton>
                    </TextButtonWrapper>
                    <GroupList
                      endpointPath={`/organizations/${orgSlug}/issues/`}
                      orgSlug={orgSlug}
                      queryParams={{query: `issue.id:[${sameRootCauseIssues}]`}}
                      query=""
                      source="related-issues-tab"
                    />
                  </div>
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
                    <TextButtonWrapper>
                      <small>
                        {t('These are the issues belonging to ')}
                        <Link
                          to={`/performance/trace/${traceMeta.trace_id}/?node=error-${traceMeta.event_id}`}
                        >
                          {t('this trace')}
                        </Link>
                      </small>
                      <LinkButton
                        href={`/issues/?query=issue.id:[${groupId},${traceConnectedIssues}]`}
                        size="xs"
                        external
                      >
                        {t('Open in Issues')}
                      </LinkButton>
                    </TextButtonWrapper>
                    <GroupList
                      endpointPath={`/organizations/${orgSlug}/issues/`}
                      orgSlug={orgSlug}
                      queryParams={{query: `issue.id:[${traceConnectedIssues}]`}}
                      query=""
                      source="related-issues-tab"
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

const TextButtonWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;
