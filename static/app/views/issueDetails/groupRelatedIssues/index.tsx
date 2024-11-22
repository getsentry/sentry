import {Fragment} from 'react';
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
import {useParams} from 'sentry/utils/useParams';

type RelatedIssuesResponse = {
  data: number[];
  meta: {
    event_id: string;
    trace_id: string;
  };
  type: string;
};

interface RelatedIssuesSectionProps {
  groupId: string;
  orgSlug: string;
  relationType: string;
}

function GroupRelatedIssues() {
  const params = useParams<{groupId: string}>();

  const organization = useOrganization();
  const orgSlug = organization.slug;

  return (
    <Fragment>
      <RelatedIssuesSection
        groupId={params.groupId}
        orgSlug={orgSlug}
        relationType="same_root_cause"
      />
      <RelatedIssuesSection
        groupId={params.groupId}
        orgSlug={orgSlug}
        relationType="trace_connected"
      />
    </Fragment>
  );
}

function RelatedIssuesSection({
  groupId,
  orgSlug,
  relationType,
}: RelatedIssuesSectionProps) {
  // Fetch the list of related issues
  const {
    isPending,
    isError,
    data: relatedIssues,
    refetch,
  } = useApiQuery<RelatedIssuesResponse>(
    [`/issues/${groupId}/related-issues/?type=${relationType}`],
    {
      staleTime: 0,
    }
  );

  const traceMeta = relationType === 'trace_connected' ? relatedIssues?.meta : undefined;
  const issues = relatedIssues?.data ?? [];
  const query = `issue.id:[${issues}]`;
  // project=-1 allows ensuring that the query will show issues from any projects for the org
  // This is important for traces since issues can be for any project in the org
  const baseUrl = `/organizations/${orgSlug}/issues/?project=-1`;
  let title: React.ReactNode = null;
  let extraInfo: React.ReactNode = null;
  let openIssuesButton: React.ReactNode = null;
  if (relationType === 'trace_connected' && traceMeta) {
    ({title, extraInfo, openIssuesButton} = getTraceConnectedContent(
      traceMeta,
      baseUrl,
      orgSlug
    ));
  } else {
    title = t('Issues with similar titles');
    extraInfo = t(
      'These issues have the same title and may have been caused by the same root cause.'
    );
    openIssuesButton = getLinkButton(
      `${baseUrl}&query=issue.id:[${groupId},${issues}]`,
      'Clicked Open Issues from same-root related issues',
      'similar_issues.same_root_cause_clicked_open_issues'
    );
  }

  return (
    <Fragment>
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          message={t('Unable to load related issues, please try again later')}
          onRetry={refetch}
        />
      ) : issues.length > 0 ? (
        <Fragment>
          <HeaderWrapper>
            <Title>{title}</Title>
            <TextButtonWrapper>
              <span>{extraInfo}</span>
              {openIssuesButton}
            </TextButtonWrapper>
          </HeaderWrapper>
          <GroupList
            orgSlug={orgSlug}
            queryParams={{query: query}}
            source="similar-issues-tab"
            canSelectGroups={false}
            withChart={false}
            withColumns={['event']}
          />
        </Fragment>
      ) : null}
    </Fragment>
  );
}

const getTraceConnectedContent = (
  traceMeta: RelatedIssuesResponse['meta'],
  baseUrl: string,
  orgSlug: string
) => {
  const title = t('Issues in the same trace');
  const url = `/organizations/${orgSlug}/performance/trace/${traceMeta.trace_id}/?node=error-${traceMeta.event_id}`;
  const extraInfo = (
    <small>
      {t('These issues were all found within')}
      <Link to={url}>{t('this trace')}</Link>.
    </small>
  );
  const openIssuesButton = getLinkButton(
    `${baseUrl}&query=trace:${traceMeta.trace_id}`,
    'Clicked Open Issues from trace-connected related issues',
    'similar_issues.trace_connected_issues_clicked_open_issues'
  );

  return {title, extraInfo, openIssuesButton};
};

const getLinkButton = (to: string, eventName: string, eventKey: string) => {
  return (
    <LinkButton
      to={to}
      size="xs"
      analyticsEventName={eventName}
      analyticsEventKey={eventKey}
    >
      {t('Open in Issues')}
    </LinkButton>
  );
};

// Export the component without feature flag controls
export {GroupRelatedIssues};

const Title = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.75)};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;

const TextButtonWrapper = styled('div')`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  width: 100%;
`;
