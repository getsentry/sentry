import {getOrganizationAvatarProps} from '@sentry/scraps/avatar';
import {useAvatarColors, useAvatarGradient} from '@sentry/scraps/avatarButton';

import {useOrganization} from 'sentry/utils/useOrganization';

const DEFAULT_GRADIENT = {start: '#2c155c', end: '#4e168c'};

interface OrganizationPalette {
  /**
   * `AvatarButton`'s `frameColor`: the color the organization's own avatar
   * button uses, so other buttons match it. `undefined` while the avatar has
   * no usable color (an image still being sampled).
   */
  frameColor: string | undefined;
  /** The navigation menu headers' gradient. */
  gradient: {end: string; start: string};
}

/**
 * Colors taken from the current organization's avatar, so the navigation menus
 * and buttons match the organization. The gradient is the default purple
 * without an organization, while its image is being sampled, and for gray logos.
 */
export function useOrganizationPalette(): OrganizationPalette {
  const organization = useOrganization({allowNull: true});
  const avatar = organization ? getOrganizationAvatarProps(organization) : undefined;
  const colors = useAvatarColors(avatar);
  return {
    gradient: useAvatarGradient(avatar, DEFAULT_GRADIENT),
    frameColor: colors.type === 'none' ? undefined : colors.chonk,
  };
}
