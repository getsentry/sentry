import {Flex} from 'sentry/components/core/layout';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconDelete, IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';

interface BuildDetailsActionsConfig {
  handleDeleteAction: () => void;
  handleDownloadAction: () => void;
  isSentryEmployee: boolean;
}

export function createActionMenuItems({
  handleDeleteAction,
  handleDownloadAction,
  isSentryEmployee,
}: BuildDetailsActionsConfig): MenuItemProps[] {
  const menuItems: MenuItemProps[] = [];

  menuItems.push({
    key: 'delete',
    label: (
      <Flex align="center" gap="sm">
        <IconDelete size="sm" />
        {t('Delete Build')}
      </Flex>
    ),
    onAction: handleDeleteAction,
    textValue: t('Delete Build'),
  });

  if (isSentryEmployee) {
    menuItems.push({
      key: 'admin-section',
      label: t('Admin (Sentry Employees only)'),
      children: [
        {
          key: 'download',
          label: (
            <Flex align="center" gap="sm">
              <IconDownload size="sm" />
              {t('Download Build')}
            </Flex>
          ),
          onAction: handleDownloadAction,
          textValue: t('Download Build'),
        },
      ],
    });
  }

  return menuItems;
}
