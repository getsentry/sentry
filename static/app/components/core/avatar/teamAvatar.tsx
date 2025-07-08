import type React from 'react';

import type {Team} from 'sentry/types/organization';
import {explodeSlug} from 'sentry/utils';

import {BaseAvatar, type BaseAvatarProps} from './baseAvatar';

export interface TeamAvatarProps extends BaseAvatarProps {
  team: Team | undefined;
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
}

export function TeamAvatar({ref, team, tooltip: tooltipProp, ...props}: TeamAvatarProps) {
  if (!team) {
    // @TODO(jonasbadalic): Do we need a placeholder here?
    return null;
  }

  const slug = team?.slug || '';
  const title = explodeSlug(slug);
  const tooltip = tooltipProp ?? `#${title}`;

  return (
    <BaseAvatar
      {...props}
      ref={ref}
      type={team.avatar?.avatarType || 'letter_avatar'}
      letterId={slug}
      tooltip={tooltip}
      title={title}
    />
  );
}
