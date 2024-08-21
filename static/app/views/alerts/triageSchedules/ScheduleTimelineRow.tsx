import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import {space} from 'sentry/styles/space';
import type {UserSchedulePeriod} from 'sentry/views/alerts/triageSchedules/triageSchedulesList';

interface ScheduleTimelineRowProps {
  name: string;
  // Must have at least one entry
  schedulePeriods: UserSchedulePeriod[];
  totalWidth: number;
}

export function ScheduleTimelineRow({
  name,
  totalWidth,
  schedulePeriods,
}: ScheduleTimelineRowProps) {
  return (
    <TimelineRow>
      <DetailsArea>
        <DetailsHeadline>
          <Name>{name}</Name>
        </DetailsHeadline>
      </DetailsArea>
      <OnRotationContainer>
        <ScheduleTitle>On Rotation Now:</ScheduleTitle>
        {schedulePeriods[0].user && <ParticipantList users={[schedulePeriods[0].user]} />}
      </OnRotationContainer>
      <ScheduleContainer>
        <ScheduleOuterContainer>
          <ScheduleTimeline periods={schedulePeriods} width={totalWidth} />
        </ScheduleOuterContainer>
      </ScheduleContainer>
    </TimelineRow>
  );
}

// Super jank right now but for sake of demoing, make sure the percentages for all users add up to 100.
// Adding more will overflow
function ScheduleTimeline({
  periods,
  width,
}: {
  periods: UserSchedulePeriod[];
  width: number;
}) {
  let currPosition = 0;
  return (
    <TimelineContainer>
      {periods.map(({percentage, user, backgroundColor}, index) => {
        const periodWidth = (percentage / 100) * width;
        currPosition += periodWidth;
        return user ? (
          <SchedulePeriod
            style={{
              left: currPosition - periodWidth,
              width: currPosition,
              backgroundColor,
            }}
            key={index}
          >
            <UserAvatar style={{fillOpacity: 1.0}} user={user} />
            <ScheduleName>{user.name}</ScheduleName>
          </SchedulePeriod>
        ) : null;
      })}
    </TimelineContainer>
  );
}

const TimelineContainer = styled('div')`
  position: relative;
  height: 100%;
`;

const SchedulePeriod = styled('div')`
  position: absolute;
  gap: ${space(1)};
  display: flex;
  align-items: center;
  padding-left: ${space(1)};
  top: calc(50% + 1px);
  width: 4px;
  height: 28px;
  transform: translateY(-50%);

  fill-opacity: 0.7;

  border-top-left-radius: 2px;
  border-bottom-left-radius: 2px;

  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
`;

const DetailsArea = styled('div')`
  border-right: 1px solid ${p => p.theme.border};
  border-radius: 0;
  position: relative;
  padding: ${space(3)};
  display: block;
`;

const DetailsHeadline = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr minmax(30px, max-content);
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  word-break: break-word;
  margin-bottom: ${space(0.5)};
`;

const ScheduleTitle = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0 0;
`;

const TimelineRow = styled('li')`
  grid-column: 1/-1;

  display: grid;
  grid-template-columns: subgrid;

  /* Disabled monitors become more opaque */
  --disabled-opacity: unset;

  &:last-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

const ScheduleName = styled('h6')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  margin: 0;
`;

const ScheduleContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  contain: content;
  grid-column: 3/-1;
`;

const ScheduleOuterContainer = styled('div')`
  position: relative;
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});
  opacity: var(--disabled-opacity);
`;

const OnRotationContainer = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(1)};
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.innerBorder};
  text-align: left;
`;
