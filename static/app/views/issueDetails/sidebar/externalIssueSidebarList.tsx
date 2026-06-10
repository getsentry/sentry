import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {ExternalIssueList} from 'sentry/components/group/externalIssuesList';
import {LinkedPullRequests} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';

interface Props {
  event: Event;
  group: Group;
  project: Project;
}

export function ExternalIssueSidebarList({event, group, project}: Props) {
  return (
    <SidebarFoldSection
      dataTestId="linked-issues"
      title={
        <Heading as="h3" size="md">
          {t('Issue Tracking')}
        </Heading>
      }
      sectionKey={SectionKey.EXTERNAL_ISSUES}
    >
      <Flex direction="column" gap="md">
        <ExternalIssueList group={group} event={event} project={project} />
        <ErrorBoundary customComponent={null}>
          <LinkedPullRequests group={group} />
        </ErrorBoundary>
      </Flex>
    </SidebarFoldSection>
  );
}
