import {Flex} from 'sentry/components/core/layout';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconArchive, IconDelete, IconShare} from 'sentry/icons';
import {t} from 'sentry/locale';

interface BuildDetailsActionsConfig {
  handleArchiveAction: () => void;
  handleDeleteAction: () => void;
  handleShareAction: () => void;
}

export function createActionMenuItems({
  handleDeleteAction,
  handleArchiveAction,
  handleShareAction,
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
    {
      key: 'archive',
      label: (
        <Flex align="center" gap="sm">
          <IconArchive size="sm" />
          {t('Archive Build')}
        </Flex>
      ),
      onAction: handleArchiveAction,
      textValue: t('Archive Build'),
    },
    {
      key: 'share',
      label: (
        <Flex align="center" gap="sm">
          <IconShare size="sm" />
          {t('Share Build')}
        </Flex>
      ),
      onAction: handleShareAction,
      textValue: t('Share Build'),
    },
  ];
}
