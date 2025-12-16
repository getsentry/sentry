import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

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
      title={<Title>{t('Issue Tracking')}</Title>}
      sectionKey={SectionKey.EXTERNAL_ISSUES}
    >
      <Stack direction="column" gap="sm">
        <StreamlinedExternalIssueList group={group} event={event} project={project} />
      </Stack>
    </SidebarFoldSection>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
`;
