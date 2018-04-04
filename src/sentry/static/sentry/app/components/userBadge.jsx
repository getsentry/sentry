import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Avatar from './avatar';
import Link from './link';
import overflowEllipsis from '../styles/overflowEllipsis';
import space from '../styles/space';

const UserBadge = ({
  displayName,
  displayEmail,
  user,
  orgId,
  avatarSize,
  useLink,
  ...props
}) => {
  const LinkOrText = useLink
    ? props => <StyledLink to={`/settings/${orgId}/members/${user.id}`} {...props} />
    : 'div';

  return (
    <StyledUserBadge {...props}>
      <StyledAvatar user={user} size={avatarSize} />
      <StyledNameAndEmail>
        <LinkOrText>{displayName || user.name || user.email}</LinkOrText>
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
  margin-top: ${space(0.5)};
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;

const StyledLink = styled(Link)`
  font-weight: bold;
  margin-bottom: ${space(0.5)};
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <Avatar {...props} />)`
  min-width: ${space(3)};
  min-height: ${space(3)};
  margin-right: ${space(1)};
`;

export default UserBadge;
