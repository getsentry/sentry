import React from 'react';
import PropTypes from 'prop-types';

import {Actor, AvatarUser} from 'app/types';
import {userDisplayName} from 'app/utils/formatters';
import BaseAvatar from 'app/components/avatar/baseAvatar';
import SentryTypes from 'app/sentryTypes';
import {isRenderFunc} from 'app/utils/isRenderFunc';

type RenderTooltipFunc = (user: AvatarUser | Actor) => React.ReactNode;

const defaultProps = {
  // Default gravatar to false in order to support transparent avatars
  // Avatar falls through to letter avatars if a remote image fails to load,
  // however gravatar sends back a transparent image when it does not find a gravatar,
  // so there's little we have to control whether we need to fallback to letter avatar
  gravatar: false,
};

type DefaultProps = typeof defaultProps;

type Props = {
  user?: Actor | AvatarUser;
  renderTooltip?: RenderTooltipFunc;
} & Partial<DefaultProps> &
  Omit<BaseAvatar['props'], 'uploadPath' | 'uploadId'>;

function isActor(maybe: AvatarUser | Actor): maybe is Actor {
  return typeof (maybe as AvatarUser).email === 'undefined';
}

class UserAvatar extends React.Component<Props> {
  static propTypes: any = {
    user: SentryTypes.User,
    gravatar: PropTypes.bool,
    renderTooltip: PropTypes.func,
    ...BaseAvatar.propTypes,
  };

  static defaultProps = defaultProps;

  getType = (user: AvatarUser | Actor, gravatar: boolean | undefined) => {
    if (isActor(user)) {
      return 'letter_avatar';
    }
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

    const avatarData = isActor(user)
      ? {
          uploadId: '',
          gravatarId: '',
          letterId: user.name,
          title: user.name,
        }
      : {
          uploadId: user.avatar?.avatarUuid ?? '',
          gravatarId: user.email?.toLowerCase(),
          letterId: user.email || user.username || user.id || user.ip_address,
          title: user.name || user.email || user.username || '',
        };

    return (
      <BaseAvatar
        round
        {...props}
        type={type}
        uploadPath="avatar"
        uploadId={avatarData.uploadId}
        gravatarId={avatarData.gravatarId}
        letterId={avatarData.letterId}
        title={avatarData.title}
        tooltip={tooltip}
      />
    );
  }
}
export default UserAvatar;
