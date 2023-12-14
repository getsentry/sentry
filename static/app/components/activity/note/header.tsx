import styled from '@emotion/styled';

import {ActivityAuthor} from 'sentry/components/activity/author';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {User} from 'sentry/types';

type Props = {
  authorName: string;
  onDelete: () => void;
  onEdit: () => void;
  user?: User;
};

function NoteHeader({authorName, user, onEdit, onDelete}: Props) {
  const activeUser = ConfigStore.get('user');
  const canEdit = activeUser && (activeUser.isSuperuser || user?.id === activeUser.id);

  return (
    <Container>
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
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

export {NoteHeader};
