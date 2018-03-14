import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Avatar from './avatar';
import overflowEllipsis from '../styles/overflowEllipsis';

const UserListElement = ({user, ...props}) => {
  return (
    <StyledUserListElement {...props}>
      <StyledAvatar user={user} size={24} className="avatar" />
      <StyledNameOrEmail>{user.name || user.email}</StyledNameOrEmail>
    </StyledUserListElement>
  );
};

UserListElement.propTypes = {
  user: PropTypes.object,
};

const StyledUserListElement = styled('div')`
  display: flex;
  align-items: center;
  padding: 0.25em 0;
`;

const StyledNameOrEmail = styled('div')`
  flex-shrink: 1;
  min-width: 0;
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <Avatar {...props} />)`
  min-width: 1.75em;
  min-height: 1.75em;
  width: 1.5em;
  height: 1.5em;
  margin-right: 0.33em;
`;

export default UserListElement;
