import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {space} from 'sentry/styles/space';
import {AvatarUser} from 'sentry/types';

export interface UserBadgeProps {
  avatarSize?: React.ComponentProps<typeof UserAvatar>['size'];
  className?: string;
  displayEmail?: React.ReactNode | string;
  displayName?: React.ReactNode;
  hideEmail?: boolean;
  user?: AvatarUser;
}

function UserBadge({
  avatarSize = 24,
  hideEmail = false,
  displayName,
  displayEmail,
  user,
  className,
}: UserBadgeProps) {
  const title =
    displayName ||
    (user &&
      (user.name ||
        user.email ||
        user.username ||
        user.ipAddress ||
        // Because this can be used to render EventUser models, or User *interface*
        // objects from serialized Event models. we try both ipAddress and ip_address.
        user.ip_address ||
        user.ip ||
        user.id));

  return (
    <StyledUserBadge className={className}>
      <StyledAvatar user={user} size={avatarSize} />
      <StyledNameAndEmail>
        <StyledName hideEmail={!!hideEmail}>{title}</StyledName>
        {!hideEmail && <StyledEmail>{displayEmail || (user && user.email)}</StyledEmail>}
      </StyledNameAndEmail>
    </StyledUserBadge>
  );
}

const StyledUserBadge = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledNameAndEmail = styled('div')`
  flex-shrink: 1;
  min-width: 0;
  line-height: normal;
`;

const StyledEmail = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray300};
  ${p => p.theme.overflowEllipsis};
`;

export const StyledName = styled('span')<{hideEmail: boolean}>`
  font-weight: ${p => (p.hideEmail ? 'inherit' : 'bold')};
  line-height: 1.15em;
  ${p => p.theme.overflowEllipsis};
`;

const StyledAvatar = styled(UserAvatar)`
  min-width: ${space(3)};
  min-height: ${space(3)};
  margin-right: ${space(1)};
`;

export default UserBadge;
