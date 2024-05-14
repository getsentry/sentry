import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/avatar/baseAvatar';
import type {Team} from 'sentry/types/organization';
import {explodeSlug} from 'sentry/utils';

interface Props extends BaseAvatarProps {
  team: Team | null | undefined;
}

function TeamAvatar({team, tooltip: tooltipProp, ...props}: Props) {
  if (!team) {
    return null;
  }

  const slug = team?.slug || '';
  const title = explodeSlug(slug);
  const tooltip = tooltipProp ?? `#${title}`;

  return (
    <BaseAvatar
      {...props}
      type={team.avatar?.avatarType || 'letter_avatar'}
      letterId={slug}
      tooltip={tooltip}
      title={title}
    />
  );
}

export default TeamAvatar;
