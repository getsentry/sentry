import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';

import {
  ExternalIssueListContent,
  ExternalIssueListLinkButton,
  useExternalIssueList,
} from './externalIssueList';

interface Props {
  group: Group;
  event?: Event;
}

export function ExternalIssueSidebarSection({group, event}: Props) {
  const externalIssues = useExternalIssueList({group, event});

  return (
    <SidebarFoldSection
      dataTestId="linked-issues"
      title={
        <Heading as="h3" size="md">
          {t('External Links')}
        </Heading>
      }
      actions={
        externalIssues.showEmptyIssueTrackerAction ? undefined : (
          <ExternalIssueListLinkButton {...externalIssues} />
        )
      }
      sectionKey={SectionKey.EXTERNAL_ISSUES}
    >
      <ExternalIssueListContent {...externalIssues} />
    </SidebarFoldSection>
  );
}
