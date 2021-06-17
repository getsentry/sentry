import styled from '@emotion/styled';

import Card from 'app/components/card';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import ShortId from 'app/components/shortId';
import TimeSince from 'app/components/timeSince';
import {IconClock} from 'app/icons';
import {tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Event} from 'app/types/event';

type Props = {
  sampleEvent: Event;
  eventCount: number;
  organization: Organization;
  project?: Project;
};

function NewIssue({sampleEvent, eventCount, organization, project}: Props) {
  return (
    <StyledCard interactive={false}>
      <div>
        <EventOrGroupHeader
          data={sampleEvent}
          organization={organization}
          hideIcons
          hideLevel
        />
        <Details>
          {project && (
            <GroupShortId
              shortId={project.slug}
              avatar={
                project && <ProjectBadge project={project} avatarSize={14} hideName />
              }
              onClick={e => {
                // prevent the clicks from propagating so that the short id can be selected
                e.stopPropagation();
              }}
            />
          )}
          <TimeWrapper>
            <IconClock size="xs" />
            <TimeSince date={sampleEvent.dateCreated} />
          </TimeWrapper>
        </Details>
      </div>
      <ErrorsCount>
        {eventCount}
        <ErrorLabel>{tn('Error', 'Errors', eventCount)}</ErrorLabel>
      </ErrorsCount>
    </StyledCard>
  );
}

export default NewIssue;

const StyledCard = styled(Card)`
  margin-bottom: -1px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  padding: ${space(1.5)} ${space(2)};
  grid-gap: ${space(2)};
  word-break: break-word;
`;

const Details = styled('div')`
  margin-top: ${space(0.5)};
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(2)};
  justify-content: flex-start;
`;

const GroupShortId = styled(ShortId)`
  flex-shrink: 0;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const TimeWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const ErrorsCount = styled('div')`
  display: grid;
  align-items: center;
  justify-items: center;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const ErrorLabel = styled('div')`
  text-transform: uppercase;
  font-weight: 500;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
`;
