import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Avatar from 'app/components/avatar';
import Link from 'app/components/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const UserBadge = ({
  displayName,
  displayEmail,
  user,
  orgId,
  avatarSize,
  useLink,
  hideEmail,
  ...props
}) => {
  return (
    <StyledUserBadge {...props}>
      <StyledAvatar user={user} size={avatarSize} />
      <StyledNameAndEmail>
        <StyledName
          useLink={useLink}
          hideEmail={hideEmail}
          to={`/settings/${orgId}/members/${user.id}`}
        >
          {displayName || user.name || user.email}
        </StyledName>
        {!hideEmail && <StyledEmail>{displayEmail || user.email}</StyledEmail>}
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
  hideEmail: PropTypes.bool,
};

UserBadge.defaultProps = {
  useLink: true,
  hideEmail: false,
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

const StyledName = styled(
  ({useLink, hideEmail, to, ...props}) =>
    useLink ? <Link to={to} {...props} /> : <span {...props} />
)`
  font-weight: bold;
  margin-bottom: ${p => (!p.hideEmail ? space(0.5) : 0)};
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <Avatar {...props} />)`
  min-width: ${space(3)};
  min-height: ${space(3)};
  margin-right: ${space(1)};
`;

export default UserBadge;
