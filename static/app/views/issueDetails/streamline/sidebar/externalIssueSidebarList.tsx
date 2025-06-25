import styled from '@emotion/styled';

import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
      <Separator>
        <StreamlinedExternalIssueList group={group} event={event} project={project} />
      </Separator>
    </SidebarFoldSection>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
`;

const Separator = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
