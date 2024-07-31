import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import EventNavigation from 'sentry/views/issueDetails/eventNavigation';
import {GroupEventCarousel} from 'sentry/views/issueDetails/groupEventCarousel';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type GroupEventHeaderProps = {
  event: Event;
  group: Group;
  project: Project;
};

function GroupEventHeader({event, group, project}: GroupEventHeaderProps) {
  const hasUpdatedEventNavigation = useHasStreamlinedUI();
  return (
    <StyledDataSection>
      {hasUpdatedEventNavigation ? (
        <EventNavigation event={event} group={group} />
      ) : (
        <GroupEventCarousel group={group} event={event} projectSlug={project.slug} />
      )}
    </StyledDataSection>
  );
}

const StyledDataSection = styled(DataSection)`
  padding: ${space(1)} ${space(2)} 0;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(1.5)} ${space(4)} 0;
  }
`;

export default GroupEventHeader;
