import {useMemo} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';

type ChartContextMenuProps = {
  setVisible: (visible: boolean) => void;
  visible: boolean;
};

export function ChartContextMenu({visible, setVisible}: ChartContextMenuProps) {
  const items: MenuItemProps[] = useMemo(() => {
    const menuItems = [];

    const newAlertLabel = t('Create a Monitor');

    menuItems.push({
      key: 'create-alert',
      textValue: newAlertLabel,
      label: newAlertLabel,
      disabled: true,
      to: '',
      onAction: () => {},
    });

    // TODO: remove this once we have dashboards support for errors
    menuItems.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      label: t('Add to Dashboard'),
      disabled: true,
      onAction: () => {},
    });

    if (visible) {
      menuItems.push({
        key: 'hide-chart',
        textValue: t('Hide Chart'),
        label: t('Hide Chart'),
        onAction: () => setVisible(false),
      });
    } else {
      menuItems.push({
        key: 'show-chart',
        textValue: t('Show Chart'),
        label: t('Show Chart'),
        onAction: () => setVisible(true),
      });
    }

    return menuItems;
  }, [visible, setVisible]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="xs"
          variant="transparent"
          aria-label={t('Context Menu')}
          icon={<IconEllipsis />}
        />
      )}
      position="bottom-end"
      items={items}
    />
  );
}
