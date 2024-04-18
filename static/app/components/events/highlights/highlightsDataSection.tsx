import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {TagContainer} from 'sentry/components/events/eventTags/eventTagsTree';
import {
  useHasNewTagsUI,
  useIssueDetailsColumnCount,
} from 'sentry/components/events/eventTags/util';
import HighlightsColumns from 'sentry/components/events/highlights/highilightsColumns';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';

interface HighlightsSectionProps {
  event: Event;
  group: Group;
  project: Project;
}

export default function HighlightsDataSection({
  event,
  group,
  project,
}: HighlightsSectionProps) {
  const hasNewTagsUI = useHasNewTagsUI();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);

  if (!hasNewTagsUI) {
    return null;
  }

  return (
    <EventDataSection
      title={t('Event Highlights')}
      data-test-id="event-highlights"
      type="event-highlights"
      actions={
        <ButtonBar gap={1}>
          <LinkButton href="#tags" size="xs">
            {t('All Tags')}
          </LinkButton>
          <LinkButton href="#context" size="xs">
            {t('All Context')}
          </LinkButton>
          <Button size="xs" icon={<IconEdit />}>
            {t('Edit')}
          </Button>
        </ButtonBar>
      }
    >
      <HighlightContainer ref={containerRef} columnCount={columnCount}>
        <HighlightsColumns
          event={event}
          group={group}
          project={project}
          columnCount={columnCount}
        />
      </HighlightContainer>
    </EventDataSection>
  );
}

const HighlightContainer = styled(TagContainer)<{columnCount: number}>`
  margin-top: 0;
  margin-bottom: ${space(2)};
`;
