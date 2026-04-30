import {useMemo} from 'react';

import Feature from 'sentry/components/acl/feature';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DisabledText} from 'sentry/views/explore/components/chartContextMenu';

type ChartContextMenuProps = {
  setVisible: (visible: boolean) => void;
  visible: boolean;
};

export function ChartContextMenu({visible, setVisible}: ChartContextMenuProps) {
  const organization = useOrganization();
  const items: MenuItemProps[] = useMemo(() => {
    const menuItems = [];

    const newAlertLabel = organization.features.includes('workflow-engine-ui')
      ? t('Create a Monitor')
      : t('Create an Alert');

    menuItems.push({
      key: 'create-alert',
      textValue: newAlertLabel,
      label: newAlertLabel,
      disabled: true,
      to: '',
      onAction: () => {},
    });

    // TODO: remove this once we have dashboards support for errors
    const disableAddToDashboard =
      !organization.features.includes('dashboards-edit') || true;
    menuItems.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('Add to Dashboard')}</DisabledText>}
        >
          {t('Add to Dashboard')}
        </Feature>
      ),
      disabled: disableAddToDashboard,
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
  }, [organization, visible, setVisible]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      triggerProps={{
        size: 'xs',
        priority: 'transparent',
        showChevron: false,
        'aria-label': t('Context Menu'),
        icon: <IconEllipsis />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}
