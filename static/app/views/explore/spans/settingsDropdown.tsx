import {useMemo} from 'react';
import {IconSettings} from '@sentry/icons/settings';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useQueryParamsExtrapolate,
  useSetQueryParamsExtrapolate,
} from 'sentry/views/explore/queryParams/context';

export function SettingsDropdown() {
  const organization = useOrganization();
  const extrapolate = useQueryParamsExtrapolate();
  const setExtrapolate = useSetQueryParamsExtrapolate();

  const items: MenuItemProps[] = useMemo(() => {
    const toggleExtrapolation = (enabled: boolean) => {
      trackAnalytics('trace.explorer.extrapolation_toggled', {
        organization,
        organization_id: organization.id,
        enabled,
        source: 'settings_dropdown',
      });
      setExtrapolate(enabled);
    };

    const menuItems = [];

    if (extrapolate) {
      menuItems.push({
        key: 'disable-extrapolation',
        textValue: t('Disable Extrapolation'),
        label: t('Disable Extrapolation'),
        onAction: () => toggleExtrapolation(false),
      });
    } else {
      menuItems.push({
        key: 'enable-extrapolation',
        textValue: t('Enable Extrapolation'),
        label: t('Enable Extrapolation'),
        onAction: () => toggleExtrapolation(true),
      });
    }

    return menuItems;
  }, [extrapolate, organization, setExtrapolate]);

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="xs"
          icon={<IconSettings />}
          aria-label={t('Settings')}
        />
      )}
      position="bottom-end"
      items={items}
    />
  );
}
