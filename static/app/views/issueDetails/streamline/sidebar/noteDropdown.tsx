import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {useUser} from 'sentry/utils/useUser';

type Props = {
  onDelete: () => void;
  user?: User | null;
};

function NoteDropdown({user, onDelete, ...props}: Props & Partial<DropdownMenuProps>) {
  const activeUser = useUser();
  const canEdit = activeUser && (activeUser.isSuperuser || user?.id === activeUser.id);

  if (!canEdit) {
    return null;
  }

  return (
    <DropdownMenu
      offset={4}
      size="sm"
      triggerProps={{
        size: 'zero',
        showChevron: false,
        borderless: true,
        icon: <IconEllipsis />,
        'aria-label': t('Comment Actions'),
      }}
      items={[
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
              onConfirm: onDelete,
            }),
          tooltip: activeUser.isSuperuser
            ? t('You can delete this comment due to your superuser status')
            : undefined,
        },
      ]}
      {...props}
    />
  );
}

export {NoteDropdown};
