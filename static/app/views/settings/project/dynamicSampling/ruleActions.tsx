import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  canDelete: boolean;
  noPermission: boolean;
  onDelete: () => void;
  onEditRule: () => void;
};

export function RuleActions({noPermission, canDelete, onDelete, onEditRule}: Props) {
  return (
    <DropdownMenuControl
      position="bottom-end"
      triggerProps={{
        size: 'xs',
        icon: <IconEllipsis size="xs" />,
        showChevron: false,
        'aria-label': t('Actions'),
      }}
      items={[
        {
          key: 'edit',
          label: t('Edit'),
          details: noPermission
            ? t("You don't have permission to edit rules")
            : undefined,
          onAction: onEditRule,
          disabled: noPermission,
        },
        {
          key: 'delete',
          label: t('Delete'),
          details: canDelete ? undefined : t("You don't have permission to delete rules"),
          onAction: () =>
            openConfirmModal({
              onConfirm: onDelete,
              message: t('Are you sure you wish to delete this rule?'),
            }),
          disabled: !canDelete,
          priority: 'danger',
        },
      ]}
    />
  );
}
