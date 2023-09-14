import {css} from '@emotion/react';
import styled from '@emotion/styled';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Tooltip} from 'sentry/components/tooltip';
import {AvatarUser} from 'sentry/types';
import {TeamParticipant} from 'sentry/types/group';

type UserAvatarProps = React.ComponentProps<typeof UserAvatar>;

type Props = {
  members: Array<AvatarUser | TeamParticipant>;
  avatarSize?: number;
  className?: string;
  maxVisibleAvatars?: number;
  renderTooltip?: UserAvatarProps['renderTooltip'];
  tooltipOptions?: UserAvatarProps['tooltipOptions'];
  typeMembers?: string;
};

function AvatarList({
  avatarSize = 28,
  maxVisibleAvatars = 5,
  typeMembers = 'users',
  tooltipOptions = {},
  className,
  members,
  renderTooltip,
}: Props) {
  const visibleMembers = members.slice(0, maxVisibleAvatars);
  const numCollapsedUsers = members.length - members.length;

  if (!tooltipOptions.position) {
    tooltipOptions.position = 'top';
  }

  return (
    <AvatarListWrapper className={className}>
      {!!numCollapsedUsers && (
        <Tooltip title={`${numCollapsedUsers} other ${typeMembers}`}>
          <CollapsedUsers size={avatarSize} data-test-id="avatarList-collapsedusers">
            {numCollapsedUsers < 99 && <Plus>+</Plus>}
            {numCollapsedUsers}
          </CollapsedUsers>
        </Tooltip>
      )}
      {visibleMembers.map(member => {
        if (member.type && member.type === 'team') {
          const team = member as TeamParticipant;
          return <TeamAvatar key={`${team.id}-${team.name}`} team={team} />;
        }
        const user = member as AvatarUser;
        return (
          <StyledAvatar
            key={`${user.id}-${user.email}`}
            user={user}
            size={avatarSize}
            renderTooltip={renderTooltip}
            tooltipOptions={tooltipOptions}
            hasTooltip
          />
        );
      })}
    </AvatarListWrapper>
  );
}

export default AvatarList;

// used in releases list page to do some alignment
export const AvatarListWrapper = styled('div')`
  display: flex;
  flex-direction: row-reverse;
`;

const Circle = p => css`
  border-radius: 50%;
  border: 2px solid ${p.theme.background};
  margin-left: -8px;
  cursor: default;

  &:hover {
    z-index: 1;
  }
`;

const StyledAvatar = styled(UserAvatar)`
  overflow: hidden;
  ${Circle};
`;

const CollapsedUsers = styled('div')<{size: number}>`
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
  ${Circle};
`;

const Plus = styled('span')`
  font-size: 10px;
  margin-left: 1px;
  margin-right: -1px;
`;
