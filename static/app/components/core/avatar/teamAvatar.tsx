import {forwardRef} from 'react';

import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import type {Team} from 'sentry/types/organization';
import {explodeSlug} from 'sentry/utils';

export interface TeamAvatarProps extends BaseAvatarProps {
  team: Team | undefined;
}

export const TeamAvatar = forwardRef<HTMLSpanElement, TeamAvatarProps>(
  ({team, tooltip: tooltipProp, ...props}, ref) => {
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
);
