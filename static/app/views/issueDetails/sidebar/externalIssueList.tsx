import {Stack} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {ExternalIssueListContent as LinkedIssueListContent} from 'sentry/components/group/externalIssuesList';
import {useGroupExternalIssues} from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import {IssueTrackerActionDropdown} from 'sentry/components/group/externalIssuesList/issueTrackerActions';
import {
  getLinkedPullRequestActivityIds,
  LinkedPullRequests,
  useLinkedPullRequests,
} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';

interface Props {
  event: Event | undefined;
  group: Group;
}

type ExternalIssueListState = ReturnType<typeof useExternalIssueList>;

export function useExternalIssueList({event, group}: Props) {
  const externalIssueData = useGroupExternalIssues({group, event});
  const {data: linkedPullRequestsData, isPending: isLinkedPullRequestsLoading} =
    useLinkedPullRequests({group, includeChecksAndReview: false});
  const hasLinkedPullRequestActivity = getLinkedPullRequestActivityIds(group).size > 0;
  const showEmptyIssueTrackerAction =
    !externalIssueData.isLoading &&
    !(hasLinkedPullRequestActivity && isLinkedPullRequestsLoading) &&
    externalIssueData.integrations.length > 0 &&
    externalIssueData.linkedIssues.length === 0 &&
    linkedPullRequestsData?.pullRequests.length === 0;

  return {externalIssueData, group, showEmptyIssueTrackerAction};
}

export function ExternalIssueListLinkButton({
  externalIssueData,
  showEmptyIssueTrackerAction,
}: ExternalIssueListState) {
  if (showEmptyIssueTrackerAction) {
    return null;
  }

  return (
    <IssueTrackerActionDropdown
      integrations={externalIssueData.integrations}
      isLoading={externalIssueData.isLoading}
    />
  );
}

export function ExternalIssueListContent({
  externalIssueData,
  group,
  showEmptyIssueTrackerAction,
}: ExternalIssueListState) {
  return (
    <Stack gap="md">
      <LinkedIssueListContent
        integrations={externalIssueData.integrations}
        isLoading={externalIssueData.isLoading}
        linkedIssues={externalIssueData.linkedIssues}
      />
      <ErrorBoundary customComponent={null}>
        <LinkedPullRequests
          group={group}
          showChecksAndReview={false}
          showEmptyState={
            !showEmptyIssueTrackerAction &&
            !externalIssueData.isLoading &&
            externalIssueData.integrations.length > 0 &&
            externalIssueData.linkedIssues.length === 0
          }
          variant="compact"
        />
      </ErrorBoundary>
      {showEmptyIssueTrackerAction && (
        <IssueTrackerActionDropdown
          fullWidth
          integrations={externalIssueData.integrations}
          isLoading={externalIssueData.isLoading}
        />
      )}
    </Stack>
  );
}
