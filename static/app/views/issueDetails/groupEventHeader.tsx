import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {GroupEventCarousel} from 'sentry/views/issueDetails/groupEventCarousel';

type GroupEventHeaderProps = {
  event: Event;
  group: Group;
  project: Project;
};

export function GroupEventHeader({event, group, project}: GroupEventHeaderProps) {
  return (
    <StyledDataSection>
      <GroupEventCarousel group={group} event={event} projectSlug={project.slug} />
    </StyledDataSection>
  );
}

const StyledDataSection = styled(DataSection)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl} 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => p.theme.space.lg} ${p => p.theme.space['3xl']} 0;
  }
`;
