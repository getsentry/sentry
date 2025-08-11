import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import ScheduleAvatar from 'sentry/components/core/avatar/scheduleAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {Actor} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import type {RotationSchedule} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {TeamAvatar} from './teamAvatar';
import {UserAvatar, type UserAvatarProps} from './userAvatar';

type Props = {
  avatarSize?: number;
  className?: string;
  maxVisibleAvatars?: number;
  renderCollapsedAvatars?: (
    avatarSize: number,
    numCollapsedAvatars: number
  ) => React.ReactNode;
  renderTooltip?: UserAvatarProps['renderTooltip'];
  renderUsersFirst?: boolean;
  schedules?: RotationSchedule[];
  teams?: Team[];
  tooltipOptions?: UserAvatarProps['tooltipOptions'];
  typeAvatars?: string;
  users?: Array<Actor | AvatarUser>;
};

export function CollapsedAvatars({
  ref,
  size,
  children,
}: {
  children: React.ReactNode;
  size: number;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const hasStreamlinedUI = useHasStreamlinedUI();

  if (hasStreamlinedUI) {
    return (
      <Tag ref={ref} data-test-id="avatarList-collapsedavatars">
        {children}
      </Tag>
    );
  }
  return (
    <CollapsedAvatarsCicle
      ref={ref}
      size={size}
      data-test-id="avatarList-collapsedavatars"
    >
      {children}
    </CollapsedAvatarsCicle>
  );
}

function AvatarList({
  avatarSize = 28,
  maxVisibleAvatars = 5,
  typeAvatars = 'users',
  tooltipOptions = {},
  className,
  users = [],
  teams = [],
  schedules = [],
  renderUsersFirst = false,
  renderTooltip,
  renderCollapsedAvatars,
}: Props) {
  let remaining = maxVisibleAvatars;
  const visibleAvatarsByType = {
    schedules,
    teams,
    users,
  };
  ['schedules', 'teams', 'users'].forEach(key => {
    if (remaining - visibleAvatarsByType[key].length > 0) {
      remaining -= visibleAvatarsByType[key].length;
    } else {
      visibleAvatarsByType[key] = visibleAvatarsByType[key].slice(0, remaining);
      remaining = 0;
    }
  });

  // Reverse the order since css flex-reverse is used to display the avatars
  const numCollapsedAvatars =
    schedules.length +
    users.length +
    teams.length -
    (visibleAvatarsByType.users.length +
      visibleAvatarsByType.teams.length +
      visibleAvatarsByType.schedules.length);

  if (!tooltipOptions.position) {
    tooltipOptions.position = 'top';
  }

  const users = visibleAvatarsByType.users.map(user => (
    <StyledUserAvatar
      key={user.id}
      user={user}
      size={avatarSize}
      tooltipOptions={tooltipOptions}
      renderTooltip={renderTooltip}
      hasTooltip
    />
  ));
  const teams = visibleAvatarsByType.teams.map(team => (
    <StyledTeamAvatar
      key={`${team.id}-${team.name}`}
      team={team}
      size={avatarSize}
      tooltipOptions={tooltipOptions}
      hasTooltip
    />
  ));
  const schedules = visibleAvatarsByType.schedules.map(schedule => (
    <StyledScheduleAvatar
      key={`${schedule.id}-${schedule.name}`}
      schedule={schedule}
      size={avatarSize}
      tooltipOptions={tooltipOptions}
      hasTooltip
    />
  ));

  return (
    <AvatarListWrapper className={className}>
      {!!numCollapsedAvatars &&
        (renderCollapsedAvatars ? (
          renderCollapsedAvatars(avatarSize, numCollapsedAvatars)
        ) : (
          <Tooltip title={`${numCollapsedAvatars} other ${typeAvatars}`} skipWrapper>
            <CollapsedAvatars
              size={avatarSize}
              data-test-id="avatarList-collapsedavatars"
            >
              {numCollapsedAvatars < 99 && '+'}
              {numCollapsedAvatars}
            </CollapsedAvatars>
          </Tooltip>
        ))}

      {renderUsersFirst ? schedules + teams + users : users + schedules + teams}
    </AvatarListWrapper>
  );
}

export default AvatarList;

// used in releases list page to do some alignment
const AvatarListWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
`;

const AvatarStyle = (p: {theme: Theme}) => css`
  border: 2px solid ${p.theme.background};
  margin-left: -8px;
  cursor: default;

  &:hover {
    z-index: 1;
  }

  ${AvatarListWrapper}:hover & {
    border-color: ${p.theme.translucentBorder};
    cursor: pointer;
  }
`;

const StyledUserAvatar = styled(UserAvatar)`
  overflow: hidden;
  border-radius: 50%;
  ${AvatarStyle};
`;

const StyledTeamAvatar = styled(TeamAvatar)`
  overflow: hidden;
  ${AvatarStyle}
`;

const StyledScheduleAvatar = styled(ScheduleAvatar)`
  overflow: hidden;
  ${AvatarStyle}
`;

const CollapsedAvatarsCicle = styled('div')<{size: number}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-align: center;
  font-weight: ${p => p.theme.fontWeight.bold};
  background-color: ${p => p.theme.gray200};
  color: ${p => p.theme.subText};
  font-size: ${p => Math.floor(p.size / 2.3)}px;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 50%;
  ${AvatarStyle};
`;
