import {Flex} from 'sentry/components/core/layout';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface BuildDetailsActionsConfig {
  handleDeleteAction: () => void;
}

export function createActionMenuItems({
  handleDeleteAction,
}: BuildDetailsActionsConfig): MenuItemProps[] {
  return [
    {
      key: 'delete',
      label: (
        <Flex align="center" gap="sm">
          <IconDelete size="sm" />
          {t('Delete Build')}
        </Flex>
      ),
      onAction: handleDeleteAction,
      textValue: t('Delete Build'),
    },
  ];
}
