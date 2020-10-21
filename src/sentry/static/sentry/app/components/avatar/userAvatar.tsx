import * as React from 'react';
import PropTypes from 'prop-types';

import {AvatarUser} from 'app/types';
import {userDisplayName} from 'app/utils/formatters';
import BaseAvatar from 'app/components/avatar/baseAvatar';
import SentryTypes from 'app/sentryTypes';
import {isRenderFunc} from 'app/utils/isRenderFunc';

type RenderTooltipFunc = (user: AvatarUser) => React.ReactNode;

const defaultProps = {
  // Default gravatar to false in order to support transparent avatars
  // Avatar falls through to letter avatars if a remote image fails to load,
  // however gravatar sends back a transparent image when it does not find a gravatar,
  // so there's little we have to control whether we need to fallback to letter avatar
  gravatar: false,
};

type DefaultProps = typeof defaultProps;

type Props = {
  user?: AvatarUser;
  renderTooltip?: RenderTooltipFunc;
} & Partial<DefaultProps> &
  Omit<BaseAvatar['props'], 'uploadPath' | 'uploadId'>;

class UserAvatar extends React.Component<Props> {
  static propTypes: any = {
    user: SentryTypes.User,
    gravatar: PropTypes.bool,
    renderTooltip: PropTypes.func,
    ...BaseAvatar.propTypes,
  };

  static defaultProps = defaultProps;

  getType = (user: AvatarUser, gravatar: boolean | undefined) => {
    if (user.avatar) {
      return user.avatar.avatarType;
    }
    if (user.options && user.options.avatarType) {
      return user.options.avatarType;
    }

    return user.email && gravatar ? 'gravatar' : 'letter_avatar';
  };

  render() {
    const {user, gravatar, renderTooltip, ...props} = this.props;

    if (!user) {
      return null;
    }

    const type = this.getType(user, gravatar);
    let tooltip: React.ReactNode = null;
    if (isRenderFunc<RenderTooltipFunc>(renderTooltip)) {
      tooltip = renderTooltip(user);
    } else if (props.tooltip) {
      tooltip = props.tooltip;
    } else {
      tooltip = userDisplayName(user);
    }

    return (
      <BaseAvatar
        round
        {...props}
        type={type}
        uploadPath="avatar"
        uploadId={user.avatar ? user.avatar.avatarUuid || '' : ''}
        gravatarId={user && user.email && user.email.toLowerCase()}
        letterId={user.email || user.username || user.id || user.ip_address}
        tooltip={tooltip}
        title={user.name || user.email || user.username || ''}
      />
    );
  }
}
export default UserAvatar;
