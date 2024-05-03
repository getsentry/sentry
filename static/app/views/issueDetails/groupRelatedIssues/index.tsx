import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import GroupList from 'sentry/components/issues/groupList';
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
    <Fragment>
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          message={t('Unable to load related issues, please try again later')}
          onRetry={refetch}
        />
      ) : (
        <Fragment>
          <div>
            <HeaderWrapper>
              <Title>{t('Issues caused by the same root cause')}</Title>
              {sameRootCauseIssues.length > 0 ? (
                <div>
                  <TextButtonWrapper>
                    <div />
                    <LinkButton
                      to={`/organizations/${orgSlug}/issues/?query=issue.id:[${groupId},${sameRootCauseIssues}]`}
                      size="xs"
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
                    canSelectGroups={false}
                    withChart={false}
                  />
                </div>
              ) : (
                <small>{t('No same-root-cause related issues were found.')}</small>
              )}
            </HeaderWrapper>
          </div>
          <div>
            <HeaderWrapper>
              <Title>{t('Issues in the same trace')}</Title>
              {traceConnectedIssues.length > 0 ? (
                <div>
                  <TextButtonWrapper>
                    <small>
                      {t('These issues were all found within ')}
                      <Link
                        to={`/organizations/${orgSlug}/performance/trace/${traceMeta.trace_id}/?node=error-${traceMeta.event_id}`}
                      >
                        {t('this trace')}
                      </Link>
                      .
                    </small>
                    <LinkButton
                      to={`/organizations/${orgSlug}/issues/?query=trace:${traceMeta.trace_id}`}
                      size="xs"
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
                    canSelectGroups={false}
                    withChart={false}
                  />
                </div>
              ) : (
                <small>{t('No trace-connected related issues were found.')}</small>
              )}
            </HeaderWrapper>
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}

// Export the component without feature flag controls
export {GroupRelatedIssues};

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
