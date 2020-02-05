import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {AvatarUser} from 'app/types';
import UserAvatar from 'app/components/avatar/userAvatar';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';

type Props = {
  avatarSize: UserAvatar['props']['size'];
  className?: string;
  displayName?: string;
  displayEmail?: string;
  user?: AvatarUser;
  hideEmail?: boolean;
};

const UserBadge = ({
  className,
  displayName,
  displayEmail,
  avatarSize,
  hideEmail = false,
  user,
}: Props) => {
  const title =
    displayName ||
    (user &&
      (user.name ||
        user.email ||
        user.username ||
        user.ipAddress ||
        // Because this can be used to render EventUser models, or User *interface*
        // objects from serialized Event models. we try both ipAddress and ip_address.
        user.ip_address));

  return (
    <StyledUserBadge className={className}>
      <StyledAvatar user={user} size={avatarSize} />
      <StyledNameAndEmail>
        <StyledName hideEmail={!!hideEmail}>{title}</StyledName>
        {!hideEmail && <StyledEmail>{displayEmail || (user && user.email)}</StyledEmail>}
      </StyledNameAndEmail>
    </StyledUserBadge>
  );
};

UserBadge.propTypes = {
  displayName: PropTypes.node,
  displayEmail: PropTypes.node,
  avatarSize: PropTypes.number,
  /**
   * Sometimes we may not have the member object (i.e. the current user, `ConfigStore.get('user')`,
   * is an user, not a member)
   */
  user: SentryTypes.User,
  hideEmail: PropTypes.bool,
};

const StyledUserBadge = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledNameAndEmail = styled('div')`
  flex-shrink: 1;
  min-width: 0;
  line-height: 1;
`;

const StyledEmail = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;

const StyledName = styled('span')<{hideEmail: boolean}>`
  font-weight: ${p => (p.hideEmail ? 'inherit' : 'bold')};
  line-height: 1.15em;
  ${overflowEllipsis};
`;

const StyledAvatar = styled(UserAvatar)`
  min-width: ${space(3)};
  min-height: ${space(3)};
  margin-right: ${space(1)};
`;

export default UserBadge;
