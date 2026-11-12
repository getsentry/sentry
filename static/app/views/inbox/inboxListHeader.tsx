import {useTheme} from '@emotion/react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
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

  const {mutate: updateInboxItems} = useMutation(
    updateInboxItemsMutationOptions({organization, queryClient})
  );
  const {mutate: removeInboxItems} = useMutation(
    removeInboxItemsMutationOptions({organization, queryClient})
  );

  const getSelectedIds = () => (selectedIds === 'all' ? knownIds : selectedIds);

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
          <InboxFilterMenu filters={filters} setFilters={setFilters} />
        )}
      </Flex>
      <InboxFilterPills filters={filters} setFilters={setFilters} />
    </Stack>
  );
}
