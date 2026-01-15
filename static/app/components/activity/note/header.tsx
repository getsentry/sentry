import {Flex} from '@sentry/scraps/layout';

import {ActivityAuthor} from 'sentry/components/activity/author';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {useUser} from 'sentry/utils/useUser';

type Props = {
  authorName: string;
  onDelete: () => void;
  onEdit: () => void;
  // Naming is not great here, but this seems to be the author, aka user who wrote the note.
  user?: User;
};

function NoteHeader({authorName, user, onEdit, onDelete}: Props) {
  const activeUser = useUser();
  const canEdit = activeUser && (activeUser.isSuperuser || user?.id === activeUser.id);

  return (
    <Flex align="center" gap="md">
      <ActivityAuthor>{authorName}</ActivityAuthor>
      {canEdit && (
        <DropdownMenu
          offset={4}
          size="sm"
          triggerProps={{
            size: 'xs',
            showChevron: false,
            borderless: true,
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
            },
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
      )}
    </Flex>
  );
}

export {NoteHeader};
