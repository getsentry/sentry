import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import type {Team} from 'sentry/types';
import {explodeSlug} from 'sentry/utils';

type TeamAvatarProps = {
  team: Team | null | undefined;
} & BaseAvatar['props'];

function TeamAvatar({team, tooltip: tooltipProp, ...props}: TeamAvatarProps) {
  if (!team) {
    return null;
  }

  const slug = (team && team.slug) || '';
  const title = explodeSlug(slug);
  const tooltip = tooltipProp ?? `#${title}`;

  return (
    <BaseAvatar
      {...props}
      type={(team.avatar && team.avatar.avatarType) || 'letter_avatar'}
      letterId={slug}
      tooltip={tooltip}
      title={title}
    />
  );
}

export default TeamAvatar;
