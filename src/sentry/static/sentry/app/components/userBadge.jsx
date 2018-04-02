import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Avatar from './avatar';
import Link from './link';
import overflowEllipsis from '../styles/overflowEllipsis';

const UserBadge = ({user, orgId, avatarSize, useLink, ...props}) => {
  const LinkOrText = useLink ? (
    <StyledLink to={`/settings/${orgId}/members/${user.id}`} />
  ) : (
    'div'
  );

  return (
    <StyledUserBadge {...props}>
      <StyledAvatar user={user} size={avatarSize} />
      <StyledNameAndEmail>
        <LinkOrText>{user.name || user.email}</LinkOrText>
        <StyledEmail>{user.email}</StyledEmail>
      </StyledNameAndEmail>
    </StyledUserBadge>
  );
};

UserBadge.propTypes = {
  avatarSize: PropTypes.number,
  user: PropTypes.object,
  orgId: PropTypes.string,
  useLink: PropTypes.bool,
};

UserBadge.defaultProps = {
  userLink: true,
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
  ${overflowEllipsis};
`;

const StyledLink = styled(Link)`
  font-weight: bold;
  margin-bottom: 0.2em;
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <Avatar {...props} />)`
  width: 2em;
  height: 2em;
  min-width: 2em;
  min-height: 2em;
  margin-right: 0.5em;
`;

export default UserBadge;
