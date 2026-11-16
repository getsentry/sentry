import type {ComponentProps} from 'react';

import {getOrganizationAvatarProps} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';

import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * The avatar buttons in the primary navigation (organization and user). They all
 * take the organization's color, so they read as one set. Account settings can
 * render without an organization; the buttons then use their own avatar's color.
 */
export function NavigationAvatarButton(
  props: Omit<ComponentProps<typeof AvatarButton>, 'frameAvatar'>
) {
  const organization = useOrganization({allowNull: true});

  return (
    <AvatarButton
      {...props}
      frameAvatar={organization ? getOrganizationAvatarProps(organization) : undefined}
    />
  );
}
