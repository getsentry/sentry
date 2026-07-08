import styled from '@emotion/styled';

import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {useUser} from 'sentry/utils/useUser';

type Props = {
  onDelete: () => Promise<void>;
  onEdit: () => void;
  user?: User | null;
};

export function CommentActionsDropdown({
  user,
  onDelete,
  onEdit,
  ...props
}: Props & Partial<DropdownMenuProps>) {
  const activeUser = useUser();
  const canEdit = activeUser && (activeUser.isSuperuser || user?.id === activeUser.id);

  if (!canEdit) {
    return null;
  }

  return (
    <StyledDropdownMenu
      offset={4}
      size="sm"
      triggerProps={{
        size: 'zero',
        showChevron: false,
        variant: 'transparent',
        icon: <IconEllipsis />,
        'aria-label': t('Comment Actions'),
      }}
      items={[
        {
          key: 'edit',
          label: t('Edit'),
          onAction: onEdit,
          tooltip: activeUser.isSuperuser
            ? t('You can edit this comment due to your superuser status')
            : undefined,
          tooltipOptions: {delay: 1000},
        },
        {
          key: 'delete',
          label: t('Remove'),
          priority: 'danger',
          onAction: () =>
            openConfirmModal({
              message: (
                <strong>{t('Are you sure you want to remove this comment?')}</strong>
              ),
              confirmText: t('Remove comment'),
              errorMessage: t('Failed to remove comment'),
              onConfirm: onDelete,
            }),
          tooltip: activeUser.isSuperuser
            ? t('You can delete this comment due to your superuser status')
            : undefined,
          tooltipOptions: {delay: 1000},
        },
      ]}
      {...props}
    />
  );
}

const StyledDropdownMenu = styled(DropdownMenu)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;
