import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {ExternalIssueListContent} from 'sentry/components/group/externalIssuesList';
import {useGroupExternalIssues} from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import {IssueTrackerActionDropdown} from 'sentry/components/group/externalIssuesList/issueTrackerActions';
import {LinkedPullRequests} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';

interface Props {
  event: Event;
  group: Group;
  project: Project;
}

export function ExternalIssueSidebarList({event, group, project}: Props) {
  const organization = useOrganization();
  const hasLinkedPullRequestsFeature = organization.features.includes(
    'issue-details-linked-pull-requests'
  );
  const externalIssueData = useGroupExternalIssues({group, event, project});

  return (
    <SidebarFoldSection
      dataTestId="linked-issues"
      title={
        <Heading as="h3" size="md">
          {hasLinkedPullRequestsFeature ? t('External Links') : t('Issue Tracking')}
        </Heading>
      }
      actions={
        hasLinkedPullRequestsFeature ? (
          <IssueTrackerActionDropdown
            integrations={externalIssueData.integrations}
            isLoading={externalIssueData.isLoading}
          />
        ) : undefined
      }
      sectionKey={SectionKey.EXTERNAL_ISSUES}
    >
      <Flex direction="column" gap="md">
        <ExternalIssueListContent
          integrations={externalIssueData.integrations}
          isLoading={externalIssueData.isLoading}
          linkedIssues={externalIssueData.linkedIssues}
        />
        <ErrorBoundary customComponent={null}>
          <LinkedPullRequests
            group={group}
            showEmptyState={
              hasLinkedPullRequestsFeature && externalIssueData.linkedIssues.length === 0
            }
          />
        </ErrorBoundary>
      </Flex>
    </SidebarFoldSection>
  );
}
