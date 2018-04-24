import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import SentryTypes from '../../proptypes';
import Avatar from '../../components/avatar';

export default class AvatarList extends React.Component {
  static propTypes = {
    users: PropTypes.arrayOf(SentryTypes.User).isRequired,
    avatarSize: PropTypes.number,
    maxVisibleAvatars: PropTypes.number,
  };

  static defaultProps = {
    avatarSize: 28,
    maxVisibleAvatars: 5,
  };

  render() {
    const {users, avatarSize, maxVisibleAvatars} = this.props;
    const visibleUsers = users.slice(0, maxVisibleAvatars);
    const numCollapsedUsers = users.length - visibleUsers.length;

    return (
      <Flex direction="row-reverse">
        {visibleUsers.map(user => {
          return <StyledAvatar key={user.id} user={user} size={avatarSize} />;
        })}
        {!!numCollapsedUsers && (
          <CollapsedUsers size={avatarSize}>{numCollapsedUsers}</CollapsedUsers>
        )}
      </Flex>
    );
  }
}

const StyledAvatar = styled(props => <Avatar {...props} />)`
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid white;
  margin-left: -${p => p.size / 2}px;
`;

const CollapsedUsers = styled(({size}) => <div />)`
  position: relative;
  text-align: center;
  font-weight: 600;
  background-color: ${p => p.theme.borderLight};
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall}
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 50%;
  border: 2px solid white;
`;
