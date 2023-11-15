import {css} from '@emotion/react';
import styled from '@emotion/styled';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Tooltip} from 'sentry/components/tooltip';
import {AvatarUser, Team} from 'sentry/types';

type UserAvatarProps = React.ComponentProps<typeof UserAvatar>;

type Props = {
  avatarSize?: number;
  className?: string;
  maxVisibleAvatars?: number;
  renderTooltip?: UserAvatarProps['renderTooltip'];
  teams?: Team[];
  tooltipOptions?: UserAvatarProps['tooltipOptions'];
  typeAvatars?: string;
  users?: AvatarUser[];
};

function AvatarList({
  avatarSize = 28,
  maxVisibleAvatars = 5,
  typeAvatars = 'users',
  tooltipOptions = {},
  className,
  users = [],
  teams = [],
  renderTooltip,
}: Props) {
  const numTeams = teams.length;
  const numVisibleTeams = maxVisibleAvatars - numTeams > 0 ? numTeams : maxVisibleAvatars;
  const maxVisibleUsers =
    maxVisibleAvatars - numVisibleTeams > 0 ? maxVisibleAvatars - numVisibleTeams : 0;
  // Reverse the order since css flex-reverse is used to display the avatars
  const visibleTeamAvatars = teams.slice(0, numVisibleTeams).reverse();
  const visibleUserAvatars = users.slice(0, maxVisibleUsers).reverse();
  const numCollapsedAvatars = users.length - visibleUserAvatars.length;

  if (!tooltipOptions.position) {
    tooltipOptions.position = 'top';
  }

  return (
    <AvatarListWrapper className={className}>
      {!!numCollapsedAvatars && (
        <Tooltip title={`${numCollapsedAvatars} other ${typeAvatars}`} skipWrapper>
          <CollapsedAvatars size={avatarSize} data-test-id="avatarList-collapsedavatars">
            {numCollapsedAvatars < 99 && <Plus>+</Plus>}
            {numCollapsedAvatars}
          </CollapsedAvatars>
        </Tooltip>
      )}
      {visibleUserAvatars.map(user => (
        <StyledUserAvatar
          key={`${user.id}-${user.email}`}
          user={user}
          size={avatarSize}
          renderTooltip={renderTooltip}
          tooltipOptions={tooltipOptions}
          hasTooltip
        />
      ))}
      {visibleTeamAvatars.map(team => (
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

export default AvatarList;

// used in releases list page to do some alignment
export const AvatarListWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
`;

const AvatarStyle = p => css`
  border: 2px solid ${p.theme.background};
  margin-left: -8px;
  cursor: default;

  &:hover {
    z-index: 1;
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

const CollapsedAvatars = styled('div')<{size: number}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-align: center;
  font-weight: 600;
  background-color: ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  font-size: ${p => Math.floor(p.size / 2.3)}px;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 50%;
  ${AvatarStyle};
`;

const Plus = styled('span')`
  font-size: 10px;
  margin-left: 1px;
  margin-right: -1px;
`;
