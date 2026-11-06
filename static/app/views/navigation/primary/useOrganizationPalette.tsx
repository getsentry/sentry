import {getOrganizationAvatarProps} from '@sentry/scraps/avatar';
import {useAvatarPalette} from '@sentry/scraps/avatarButton';

import type {OrganizationSummary} from 'sentry/types/organization';

const DEFAULT_GRADIENT = {start: '#2c155c', end: '#4e168c'};

/**
 * Colors taken from the organization's avatar, so the navigation menus and
 * buttons match the organization. Without an organization, the gradient is the
 * default purple and the border color is `undefined`.
 */
export function useOrganizationPalette(
  organization: OrganizationSummary | null | undefined
) {
  return useAvatarPalette(
    organization ? getOrganizationAvatarProps(organization) : undefined,
    DEFAULT_GRADIENT
  );
}
