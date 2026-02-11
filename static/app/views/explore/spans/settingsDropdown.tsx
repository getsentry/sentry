import {useMemo} from 'react';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconSettings} from 'sentry/icons/iconSettings';
import {t} from 'sentry/locale';
import {
  useQueryParamsExtrapolate,
  useSetQueryParamsExtrapolate,
} from 'sentry/views/explore/queryParams/context';

export function SettingsDropdown() {
  const extrapolate = useQueryParamsExtrapolate();
  const setExtrapolate = useSetQueryParamsExtrapolate();

  const items: MenuItemProps[] = useMemo(() => {
    const menuItems = [];

    if (extrapolate) {
      menuItems.push({
        key: 'disable-extrapolation',
        textValue: t('Disable Extrapolation'),
        label: t('Disable Extrapolation'),
        onAction: () => setExtrapolate(false),
      });
    } else {
      menuItems.push({
        key: 'enable-extrapolation',
        textValue: t('Enable Extrapolation'),
        label: t('Enable Extrapolation'),
        onAction: () => setExtrapolate(true),
      });
    }

    return menuItems;
  }, [extrapolate, setExtrapolate]);

  return (
    <DropdownMenu
      triggerProps={{
        size: 'xs',
        showChevron: false,
        icon: <IconSettings />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}
