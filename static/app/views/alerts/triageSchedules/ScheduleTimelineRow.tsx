import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import type {
  RotationPeriod,
  RotationSchedule,
} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';

interface Props {
  schedule: RotationSchedule;
  timeWindowConfig: TimeWindowConfig;
  totalWidth: number;
}

function fillGapsInRotations(rotationPeriods: RotationPeriod[], start: Date, end: Date) {
  const filledRotations: RotationPeriod[] = [];

  const firstPeriodIndex = rotationPeriods.findIndex(period => period.endTime > start);
  rotationPeriods = rotationPeriods.slice(
    Math.min(firstPeriodIndex, rotationPeriods.length - 1)
  );
  for (const period of rotationPeriods) {
    if (period.startTime > start) {
      filledRotations.push({
        endTime: period.startTime,
        startTime: start,
        userId: null,
      });
    }
    filledRotations.push(period);
    start = period.endTime;
  }
  if (start < end) {
    filledRotations.push({
      endTime: end,
      startTime: start,
      userId: null,
    });
  }
  return filledRotations;
}

export function ScheduleTimelineRow({schedule, totalWidth, timeWindowConfig}: Props) {
  const theme = useTheme();

  const themeColors = [
    theme.green100,
    theme.blue100,
    theme.yellow100,
    theme.pink100,
    theme.purple100,
    theme.red100,
  ];
  const users: Record<string, User> = {};
  const userColors: Record<string, string> = {};
  let i = 0;
  schedule.scheduleLayers.forEach(layer => {
    layer.users.forEach(user => {
      if (user.id) {
        users[user.id] = user;
      }
      if (user.id && !userColors[user.id]) {
        userColors[user.id] = themeColors[i % themeColors.length] ?? '';
        i++;
      }
    });
  });

  const rotations = fillGapsInRotations(
    schedule.coalescedRotationPeriods,
    timeWindowConfig.start,
    timeWindowConfig.end
  );
  // debugger;
  rotations.map(rotation => {
    rotation.percentage =
      (rotation.endTime.getTime() - rotation.startTime.getTime()) /
      (timeWindowConfig.end.getTime() - timeWindowConfig.start.getTime());
    return rotation;
  });

  return (
    <TimelineRow>
      <DetailsArea>
        <DetailsHeadline>
          <Name>{schedule.name}</Name>
        </DetailsHeadline>
        <Description>
          {schedule.description ??
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod'}
        </Description>
      </DetailsArea>
      <OnRotationContainer>
        <ScheduleTitle>On Rotation:</ScheduleTitle>
        {/* TODO */}
        {/* {rotations[1].userId && <ParticipantList users={[users[rotations[1].userId]]} />} */}
      </OnRotationContainer>
      <ScheduleContainer>
        <ScheduleOuterContainer>
          <ScheduleTimeline
            periods={rotations}
            users={users}
            userColors={userColors}
            width={totalWidth}
          />
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
  users,
  userColors,
}: {
  periods: RotationPeriod[];
  userColors: {number?: string};
  users: {number?: User};
  width: number;
}) {
  let currPosition = 0;

  const tooltipContent = (userName: string, startTime: Date, endTime: Date) => {
    return (
      <div style={{display: 'flex', alignItems: 'center', flexDirection: 'column'}}>
        <OverflowEllipsisTextContainer style={{maxWidth: '200px'}}>
          {userName}
        </OverflowEllipsisTextContainer>
        <div style={{display: 'flex', alignItems: 'center'}}>
          {startTime.toLocaleDateString()}
          <StyledIconArrow direction="right" />
          {endTime.toLocaleDateString()}
        </div>
      </div>
    );
  };

  return (
    <TimelineContainer>
      {periods.map(({percentage, userId, startTime, endTime}, index) => {
        const periodWidth = (percentage || 0) * width;
        currPosition += periodWidth;
        return userId ? (
          <SchedulePeriod
            style={{
              left: currPosition - periodWidth,
              width: currPosition,
              backgroundColor: userColors[userId as keyof typeof userColors],
            }}
            key={index}
          >
            <UserAvatar
              style={{fillOpacity: 1.0}}
              user={users[userId as keyof typeof users]}
              hasTooltip
              tooltip={tooltipContent(
                users[userId as keyof typeof users]?.name ?? '',
                startTime,
                endTime
              )}
            />
            {/* {userId && <ScheduleName>{users[userId].name}</ScheduleName>} */}
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
  padding: ${space(1.5)};
  display: block;
`;

const DetailsHeadline = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr minmax(30px, max-content);
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSize.lg};
  word-break: break-word;
  margin-bottom: ${space(0.5)};
`;
const Description = styled('h3')`
  font-size: ${p => p.theme.fontSize.sm};
  word-break: break-word;
  margin-bottom: ${space(0.5)};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
`;

const ScheduleTitle = styled('h6')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.md};
  margin: 0;
`;

const TimelineRow = styled('li')`
  grid-column: 1/-1;

  display: grid;
  grid-template-columns: subgrid;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  /* Disabled monitors become more opaque */
  --disabled-opacity: unset;

  &:last-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
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
  height: calc(${p => p.theme.fontSize.lg} * ${p => p.theme.text.lineHeightHeading});
  opacity: var(--disabled-opacity);
`;

const OnRotationContainer = styled('div')`
  display: flex;
  padding: ${space(1.5)};
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.innerBorder};
  text-align: left;
`;

const StyledIconArrow = styled(IconArrow)`
  margin: 0 ${space(0.5)};
`;
