import React from 'react';
import PropTypes from 'prop-types';

import {userDisplayName} from 'app/utils/formatters';
import BaseAvatar from 'app/components/avatar/baseAvatar';
import SentryTypes from 'app/proptypes';

class UserAvatar extends React.Component {
  static propTypes = {
    user: SentryTypes.User,
    gravatar: PropTypes.bool,
    renderTooltip: PropTypes.func,
    ...BaseAvatar.propTypes,
  };

  static defaultProps = {
    // Default gravatar to false in order to support transparent avatars
    // Avatar falls through to letter avatars if a remote image fails to load,
    // however gravatar sends back a transparent image when it does not find a gravatar,
    // so there's little we have to control whether we need to fallback to letter avatar
    gravatar: false,
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
    let {user, gravatar, renderTooltip, ...props} = this.props;

    if (!user) return null;

    let type = this.getType(user, gravatar);

    return (
      <BaseAvatar
        {...props}
        type={type}
        uploadPath="avatar"
        uploadId={user.avatar && user.avatar.avatarUuid}
        gravatarId={user && user.email && user.email.toLowerCase()}
        letterId={user.email || user.username || user.id || user.ip_address}
        tooltip={
          typeof renderTooltip === 'function'
            ? renderTooltip(user)
            : userDisplayName(user)
        }
        title={user.name || user.email || user.username || ''}
        round
      />
    );
  }
}
export default UserAvatar;
