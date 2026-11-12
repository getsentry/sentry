import type {ComponentProps} from 'react';

import {AvatarButton} from '@sentry/scraps/avatarButton';

import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {useOrganizationPalette} from './useOrganizationPalette';

/**
 * An avatar button in the primary navigation. With settings v3, every one is
 * framed in the organization's color, so the organization and user buttons
 * match each other and the menu headers.
 */
export function NavigationAvatarButton(props: ComponentProps<typeof AvatarButton>) {
  const settingsV3 = useSettingsV3();
  const {frameColor} = useOrganizationPalette();
  return <AvatarButton {...props} frameColor={settingsV3 ? frameColor : undefined} />;
}
