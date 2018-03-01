import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Avatar from './avatar';
import Link from './link';

const UserBadge = ({user, orgId}) => {
  return (
    <StyledUserBadge>
      <Avatar
        user={user}
        size={80}
        style={{width: '2em', height: '2em', marginRight: '0.5em'}}
      />
      <div>
        <StyledLink to={`/settings/organization/${orgId}/members/${user.id}`}>
          {user.email}
        </StyledLink>
        <StyledEmail>{user.email}</StyledEmail>
      </div>
    </StyledUserBadge>
  );
};

UserBadge.propTypes = {
  user: PropTypes.object,
  orgId: PropTypes.string,
};

const StyledUserBadge = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledEmail = styled('div')`
  font-size: 0.875em;
`;

const StyledLink = styled(Link)`
  font-weight: bold;
  display: block;
  margin-bottom: 0.2em;
`;

export default UserBadge;
