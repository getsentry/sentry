import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import {Actor, AvatarUser} from 'sentry/types';
import {userDisplayName} from 'sentry/utils/formatters';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';

type RenderTooltipFunc = (user: AvatarUser | Actor) => React.ReactNode;

type Props = {
  gravatar?: boolean;
  renderTooltip?: RenderTooltipFunc;
  user?: Actor | AvatarUser;
} & Omit<BaseAvatar['props'], 'uploadPath' | 'uploadId'>;

function isActor(maybe: AvatarUser | Actor): maybe is Actor {
  return typeof (maybe as AvatarUser).email === 'undefined';
}

function getType(user: AvatarUser | Actor, gravatar: boolean | undefined) {
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
}

function UserAvatar({
  // Default gravatar to false in order to support transparent avatars
  // Avatar falls through to letter avatars if a remote image fails to load,
  // however gravatar sends back a transparent image when it does not find a gravatar,
  // so there's little we have to control whether we need to fallback to letter avatar
  gravatar = false,
  renderTooltip,
  user,
  ...props
}: Props) {
  if (!user) {
    return null;
  }

  const type = getType(user, gravatar);
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
        gravatarId: '',
        letterId: user.name,
        title: user.name,
        uploadUrl: '',
      }
    : {
        uploadUrl: user.avatar?.avatarUrl ?? '',
        gravatarId: user.email?.toLowerCase(),
        letterId: user.email || user.username || user.id || user.ip_address,
        title: user.name || user.email || user.username || '',
      };

  return (
    <BaseAvatar
      round
      {...props}
      type={type}
      uploadUrl={avatarData.uploadUrl}
      gravatarId={avatarData.gravatarId}
      letterId={avatarData.letterId}
      title={avatarData.title}
      tooltip={tooltip}
    />
  );
}

export default UserAvatar;
