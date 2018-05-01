import React from 'react';
import PropTypes from 'prop-types';

import {userDisplayName} from 'app/utils/formatters';
import BaseAvatar from 'app/components/avatar/baseAvatar';

class UserAvatar extends React.Component {
  static propTypes = {
    user: PropTypes.object,
    gravatar: PropTypes.bool,
    ...BaseAvatar.propTypes,
  };

  static defaultProps = {
    gravatar: true,
  };

  getType = (user, gravatar) => {
    if (user.avatar) {
      return user.avatar.avatarType;
    }
    if (user.options && user.options.avatarType) {
      return user.options.avatarType;
    }

    return user.email && gravatar ? 'gravatar' : 'letter_avatar';
  };

  render() {
    let {user, gravatar, ...props} = this.props;

    if (!user) return null;

    let type = this.getType(user, gravatar);

    return (
      <BaseAvatar
        {...props}
        type={type}
        uploadId={user.avatar && user.avatar.avatarUuid}
        gravatarId={user && user.email && user.email.toLowerCase()}
        letterId={user.email || user.username || user.id || user.ip_address}
        tooltip={userDisplayName(user)}
        title={user.name || user.email || user.username || ''}
      />
    );
  }
}
export default UserAvatar;
