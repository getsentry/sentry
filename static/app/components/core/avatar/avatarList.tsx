import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {Actor} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';

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
  teams?: Team[];
  tooltipOptions?: UserAvatarProps['tooltipOptions'];
  typeAvatars?: string;
  users?: Array<Actor | AvatarUser>;
};

export function CollapsedAvatars({
  ref,
  children,
}: {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Tag ref={ref} data-test-id="avatarList-collapsedavatars" variant="muted">
      {children}
    </Tag>
  );
}

export function AvatarList({
  avatarSize = 28,
  maxVisibleAvatars = 5,
  typeAvatars = 'users',
  tooltipOptions = {},
  className,
  users = [],
  teams = [],
  renderUsersFirst = false,
  renderTooltip,
  renderCollapsedAvatars,
}: Props) {
  const numTeams = teams.length;
  const numVisibleTeams = maxVisibleAvatars - numTeams > 0 ? numTeams : maxVisibleAvatars;
  const maxVisibleUsers =
    maxVisibleAvatars - numVisibleTeams > 0 ? maxVisibleAvatars - numVisibleTeams : 0;

  // Reverse the order since css flex-reverse is used to display the avatars
  const visibleTeamAvatars = teams.slice(0, numVisibleTeams).reverse();
  const visibleUserAvatars = users.slice(0, maxVisibleUsers).reverse();
  let numCollapsedAvatars =
    users.length + teams.length - (visibleUserAvatars.length + visibleTeamAvatars.length);

  if (numCollapsedAvatars === 1) {
    if (visibleTeamAvatars.length < teams.length) {
      visibleTeamAvatars.unshift(teams[teams.length - 1]!);
    } else if (visibleUserAvatars.length < users.length) {
      visibleUserAvatars.unshift(users[users.length - 1]!);
    }
    numCollapsedAvatars = 0;
  }

  if (!tooltipOptions.position) {
    tooltipOptions.position = 'top';
  }

  return (
    <AvatarListWrapper className={className}>
      {!!numCollapsedAvatars &&
        (renderCollapsedAvatars ? (
          renderCollapsedAvatars(avatarSize, numCollapsedAvatars)
        ) : (
          <Tooltip title={`${numCollapsedAvatars} other ${typeAvatars}`} skipWrapper>
            <CollapsedAvatars data-test-id="avatarList-collapsedavatars">
              {numCollapsedAvatars < 99 && '+'}
              {numCollapsedAvatars}
            </CollapsedAvatars>
          </Tooltip>
        ))}

      {renderUsersFirst
        ? visibleTeamAvatars.map(team => (
            <StyledTeamAvatar
              key={`${team.id}-${team.name}`}
              team={team}
              size={avatarSize}
              tooltipOptions={tooltipOptions}
              hasTooltip
            />
          ))
        : visibleUserAvatars.map(user => (
            <StyledUserAvatar
              key={user.id}
              user={user}
              size={avatarSize}
              tooltipOptions={tooltipOptions}
              renderTooltip={renderTooltip}
              hasTooltip
            />
          ))}

      {renderUsersFirst
        ? visibleUserAvatars.map(user => (
            <StyledUserAvatar
              key={user.id}
              user={user}
              size={avatarSize}
              tooltipOptions={tooltipOptions}
              renderTooltip={renderTooltip}
              hasTooltip
            />
          ))
        : visibleTeamAvatars.map(team => (
            <StyledTeamAvatar
              key={`${team.id}-${team.name}`}
              team={team}
              size={avatarSize}
              tooltipOptions={tooltipOptions}
              hasTooltip
            />
          ))}
    </AvatarListWrapper>
  );
}

// used in releases list page to do some alignment
const AvatarListWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
`;

const AvatarStyle = (p: {theme: Theme}) => css`
  border: 2px solid ${p.theme.tokens.border.primary};
  margin-left: -8px;
  cursor: default;

  &:hover {
    z-index: 1;
  }

  ${AvatarListWrapper}:hover & {
    border-color: ${p.theme.tokens.border.transparent.neutral.muted};
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
