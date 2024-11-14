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
  let linkToTrace: React.ReactNode = null;
  let openIssuesButton: React.ReactNode = null;
  if (relationType === 'trace_connected' && traceMeta) {
    title = t('Issues in the same trace');
    linkToTrace = (
      <small>
        {t('These issues were all found within ')}
        <Link
          to={`/organizations/${orgSlug}/performance/trace/${traceMeta.trace_id}/?node=error-${traceMeta.event_id}`}
        >
          {t('this trace')}
        </Link>
        .
      </small>
    );
    openIssuesButton = (
      <LinkButton
        to={`${baseUrl}&query=trace:${traceMeta.trace_id}`}
        size="xs"
        analyticsEventName="Clicked Open Issues from trace-connected related issues"
        analyticsEventKey="similar_issues.trace_connected_issues_clicked_open_issues"
      >
        {t('Open in Issues')}
      </LinkButton>
    );
  } else {
    title = t('Issues caused by the same root cause');
    openIssuesButton = (
      <LinkButton
        to={`${baseUrl}&query=issue.id:[${groupId},${issues}]`}
        size="xs"
        analyticsEventName="Clicked Open Issues from same-root related issues"
        analyticsEventKey="similar_issues.same_root_cause_clicked_open_issues"
      >
        {t('Open in Issues')}
      </LinkButton>
    );
  }

  return (
    <HeaderWrapper>
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          message={t('Unable to load related issues, please try again later')}
          onRetry={refetch}
        />
      ) : issues.length > 0 ? (
        <Fragment>
          <Title>{title}</Title>
          <TextButtonWrapper>
            {linkToTrace}
            {openIssuesButton}
          </TextButtonWrapper>
          <GroupList
            orgSlug={orgSlug}
            queryParams={{query: query}}
            source="similar-issues-tab"
            canSelectGroups={false}
            withChart={false}
          />
        </Fragment>
      ) : null}
    </HeaderWrapper>
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
