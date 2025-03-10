import {forwardRef} from 'react';

import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import type {Team} from 'sentry/types/organization';
import {explodeSlug} from 'sentry/utils';

export interface TeamAvatarProps
  extends Omit<
    BaseAvatarProps,
    'hasTooltip' | 'tooltip' | 'tooltipOptions' | 'renderTooltip'
  > {
  team: Team | undefined;
}

export const TeamAvatar = forwardRef<HTMLSpanElement, TeamAvatarProps>(
  ({team, ...props}, ref) => {
    if (!team) {
      // @TODO(jonasbadalic): Do we need a placeholder here?
      return null;
    }

    return (
      <BaseAvatar
        {...props}
        ref={ref}
        type={team.avatar?.avatarType || 'letter_avatar'}
        letterId={team.slug ?? ''}
        title={explodeSlug(team?.slug || '')}
      />
    );
  }
);
