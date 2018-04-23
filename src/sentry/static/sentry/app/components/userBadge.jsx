import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Avatar from './avatar';
import Link from './link';
import overflowEllipsis from '../styles/overflowEllipsis';

const UserBadge = ({
  displayName,
  displayEmail,
  user,
  orgId,
  avatarSize,
  useLink,
  ...props
}) => {
  return (
    <StyledUserBadge {...props}>
      <StyledAvatar user={user} size={avatarSize} />
      <StyledNameAndEmail>
        <StyledName useLink={useLink} to={`/settings/${orgId}/members/${user.id}`}>
          {displayName || user.name || user.email}
        </StyledName>
        <StyledEmail>{displayEmail || user.email}</StyledEmail>
      </StyledNameAndEmail>
    </StyledUserBadge>
  );
};

UserBadge.propTypes = {
  displayName: PropTypes.node,
  displayEmail: PropTypes.node,
  avatarSize: PropTypes.number,
  user: PropTypes.object,
  orgId: PropTypes.string,
  useLink: PropTypes.bool,
};

UserBadge.defaultProps = {
  useLink: true,
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
  margin-top: ${p => p.theme.scale(0.5)};
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;

const StyledName = styled(
  ({useLink, ...props}) => (useLink ? <Link {...props} /> : <span {...props} />)
)`
  font-weight: bold;
  margin-bottom: ${p => p.theme.scale(0.5)};
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <Avatar {...props} />)`
  min-width: ${p => p.theme.scale(3)};
  min-height: ${p => p.theme.scale(3)};
  margin-right: ${p => p.theme.scale(1)};
`;

export default UserBadge;
