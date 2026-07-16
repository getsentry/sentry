import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {ExternalIssueListContent} from 'sentry/components/group/externalIssuesList';
import {useGroupExternalIssues} from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import {IssueTrackerActionDropdown} from 'sentry/components/group/externalIssuesList/issueTrackerActions';
import {
  getLinkedPullRequestActivityIds,
  LinkedPullRequests,
  useLinkedPullRequests,
} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';

interface Props {
  event: Event;
  group: Group;
}

export function ExternalIssueSidebarList({event, group}: Props) {
  const externalIssueData = useGroupExternalIssues({group, event});
  const {data: linkedPullRequestsData, isPending: isLinkedPullRequestsLoading} =
    useLinkedPullRequests({group});
  const hasLinkedPullRequestActivity = getLinkedPullRequestActivityIds(group).size > 0;
  const showEmptyIssueTrackerAction =
    !externalIssueData.isLoading &&
    !(hasLinkedPullRequestActivity && isLinkedPullRequestsLoading) &&
    externalIssueData.integrations.length > 0 &&
    externalIssueData.linkedIssues.length === 0 &&
    linkedPullRequestsData?.pullRequests.length === 0;

  return (
    <SidebarFoldSection
      dataTestId="linked-issues"
      title={
        <Heading as="h3" size="md">
          {t('External Links')}
        </Heading>
      }
      actions={
        showEmptyIssueTrackerAction ? undefined : (
          <IssueTrackerActionDropdown
            integrations={externalIssueData.integrations}
            isLoading={externalIssueData.isLoading}
          />
        )
      }
      sectionKey={SectionKey.EXTERNAL_ISSUES}
    >
      <Stack gap="md">
        <ExternalIssueListContent
          integrations={externalIssueData.integrations}
          isLoading={externalIssueData.isLoading}
          linkedIssues={externalIssueData.linkedIssues}
        />
        <ErrorBoundary customComponent={null}>
          <LinkedPullRequests
            group={group}
            showEmptyState={
              !showEmptyIssueTrackerAction &&
              !externalIssueData.isLoading &&
              externalIssueData.integrations.length > 0 &&
              externalIssueData.linkedIssues.length === 0
            }
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
    </SidebarFoldSection>
  );
}
