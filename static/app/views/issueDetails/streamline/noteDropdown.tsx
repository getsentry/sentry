import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';

type Props = {
  onDelete: () => void;
  user?: User;
};

function NoteDropdown({user, onDelete}: Props) {
  const activeUser = ConfigStore.get('user');
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
              header: t('Remove'),
              message: t('Are you sure you wish to delete this comment?'),
              onConfirm: onDelete,
            }),
          tooltip: activeUser.isSuperuser
            ? t('You can delete this comment due to your superuser status')
            : undefined,
        },
      ]}
    />
  );
}

export {NoteDropdown};
