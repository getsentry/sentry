import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface Props {
  event: Event;
  group: Group;
  project: Project;
}

export function ExternalIssueSidebarList({event, group, project}: Props) {
  return (
    <SidebarFoldSection
      data-test-id="linked-issues"
      title={
        <Heading as="h3" size="md">
          {t('Issue Tracking')}
        </Heading>
      }
      sectionKey={SectionKey.EXTERNAL_ISSUES}
    >
      <Flex direction="column" gap="md">
        <StreamlinedExternalIssueList group={group} event={event} project={project} />
      </Flex>
    </SidebarFoldSection>
  );
}
