import {useTheme} from '@emotion/react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconDelete} from '@sentry/icons/delete';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconSettings} from '@sentry/icons/settings';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {openConfirmModal} from '@sentry/scraps/confirm';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {t, tn} from 'sentry/locale';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  removeInboxItemsMutationOptions,
  updateInboxItemsMutationOptions,
} from './inboxApiOptions';
import {InboxFilterMenu, InboxFilterPills} from './inboxFilters';
import type {InboxFilters} from './types';
import type {SetInboxFilters} from './useInboxFilters';

interface InboxListHeaderProps {
  filters: InboxFilters;
  setFilters: SetInboxFilters;
}

export function InboxListHeader({filters, setFilters}: InboxListHeaderProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {
    countSelected,
    deselectAll,
    isAllSelected,
    isAnySelected,
    knownIds,
    selectAll,
    selectedIds,
  } = useListItemCheckboxContext();

  const {mutate: updateInboxItems, mutateAsync: updateInboxItemsAsync} = useMutation(
    updateInboxItemsMutationOptions({organization, queryClient})
  );
  const {mutate: removeInboxItems, mutateAsync: removeInboxItemsAsync} = useMutation(
    removeInboxItemsMutationOptions({organization, queryClient})
  );

  const getSelectedIds = () => (selectedIds === 'all' ? knownIds : selectedIds);

  const confirmMarkAllRead = () =>
    openConfirmModal({
      message: t(
        'Mark all items in your inbox as read, including items hidden by filters?'
      ),
      confirmText: t('Mark all as read'),
      onConfirm: async () => {
        await updateInboxItemsAsync({selection: 'all', update: {isRead: true}});
      },
      errorMessage: t('Unable to mark all items as read.'),
    });

  const confirmRemoveAllRead = () =>
    openConfirmModal({
      message: t(
        'Remove all read items from your inbox, including items hidden by filters?'
      ),
      confirmText: t('Remove all read'),
      priority: 'danger',
      isDangerous: true,
      onConfirm: () => removeInboxItemsAsync('all-read'),
      errorMessage: t('Unable to remove read items.'),
    });

  const handleMarkRead = () => {
    updateInboxItems({selection: getSelectedIds(), update: {isRead: true}});
    deselectAll();
  };

  const handleRemove = () => {
    const ids = getSelectedIds();
    removeInboxItems(
      {ids},
      {
        onSuccess: () =>
          toast.success(tn('Removed %s item', 'Removed %s items', ids.length), {
            action: {
              label: t('Undo'),
              onClick: () =>
                updateInboxItems({selection: ids, update: {undoRemoval: true}}),
            },
          }),
        onError: () => toast.error(t('Unable to remove items')),
      }
    );
    deselectAll();
  };

  return (
    <Stack gap="md" padding="md xl" borderBottom="primary">
      <Flex align="center" justify="between" gap="md" minHeight={theme.form.sm.height}>
        <Flex align="center" gap="2xl" minWidth={0}>
          <Checkbox
            aria-label={t('Select all')}
            checked={isAllSelected}
            disabled={knownIds.length === 0}
            onChange={() => (isAllSelected === true ? deselectAll() : selectAll())}
          />
          {isAnySelected && (
            <Text size="sm" variant="muted" wrap="nowrap">
              {t('%s selected', countSelected)}
            </Text>
          )}
        </Flex>
        {isAnySelected ? (
          <Flex align="center" gap="md">
            <Button size="xs" onClick={handleMarkRead}>
              {t('Mark as read')}
            </Button>
            <Button size="xs" onClick={handleRemove}>
              {t('Remove')}
            </Button>
          </Flex>
        ) : (
          <Flex align="center" gap="xs">
            <InboxFilterMenu filters={filters} setFilters={setFilters} />
            <DropdownMenu
              size="sm"
              position="bottom-end"
              trigger={triggerProps => (
                <OverlayTrigger.IconButton
                  {...triggerProps}
                  size="sm"
                  variant="transparent"
                  icon={<IconEllipsis />}
                  aria-label={t('Inbox actions')}
                />
              )}
              items={[
                {
                  key: 'inbox-actions',
                  children: [
                    {
                      key: 'mark-all-read',
                      label: t('Mark all as read'),
                      leadingItems: <IconCheckmark />,
                      onAction: confirmMarkAllRead,
                    },
                    {
                      key: 'remove-all-read',
                      label: t('Remove all read'),
                      leadingItems: <IconDelete />,
                      onAction: confirmRemoveAllRead,
                    },
                  ],
                },
                {
                  key: 'notification-settings',
                  label: t('Notification settings'),
                  leadingItems: <IconSettings />,
                  to: '/settings/account/notifications/inbox/',
                },
              ]}
            />
          </Flex>
        )}
      </Flex>
      <InboxFilterPills filters={filters} setFilters={setFilters} />
    </Stack>
  );
}
