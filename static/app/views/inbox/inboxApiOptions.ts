import {mutationOptions, type QueryClient} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ListItemCheckboxState} from 'sentry/utils/list/useListItemCheckboxState';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {InboxFilters, InboxItem, InboxSubject} from './types';

const INBOX_ITEMS_PER_PAGE = 25;

type InboxItemsUpdate = {
  isRead?: boolean;
  /**
   * Only `false` (undoing a pending removal) is supported by the API.
   */
  isRemoved?: false;
};

/**
 * Items are targeted by subject when viewing a single item, since it may not be loaded,
 * or by checkbox selection for bulk actions.
 */
type InboxItemsTarget =
  | {subject: InboxSubject}
  | {selection: ListItemCheckboxState['selectedIds']};

type UpdateInboxItemsVariables = InboxItemsTarget & {update: InboxItemsUpdate};

export function inboxItemsApiOptions(organization: Organization, filters: InboxFilters) {
  return {
    ...apiOptions.asInfinite<InboxItem[]>()(
      '/organizations/$organizationIdOrSlug/inbox/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          per_page: INBOX_ITEMS_PER_PAGE,
          ...(filters.subjectType.length > 0 && {subject_type: filters.subjectType}),
          ...(filters.eventType.length > 0 && {event_type: filters.eventType}),
        },
        staleTime: 30_000,
      }
    ),
    refetchOnWindowFocus: 'always' as const,
  };
}

function getTargetQuery(target: InboxItemsTarget) {
  if ('subject' in target) {
    return {
      subject_type: [target.subject.subjectType],
      subject_id: target.subject.subjectId,
    };
  }
  return target.selection === 'all' ? {} : {id: target.selection};
}

function isTargetedItem(item: InboxItem, target: InboxItemsTarget) {
  if ('subject' in target) {
    return (
      item.subjectType === target.subject.subjectType &&
      item.subjectId === target.subject.subjectId
    );
  }
  return target.selection === 'all' || target.selection.includes(item.id);
}

/**
 * Optimistically updates the targeted items in the cached inbox list.
 * Returning null from `updateItem` drops the item from the list.
 * Returns the previous data so it can be restored if the request fails.
 */
async function updateCachedInboxItems({
  organization,
  filters,
  queryClient,
  target,
  updateItem,
}: {
  filters: InboxFilters;
  organization: Organization;
  queryClient: QueryClient;
  target: InboxItemsTarget;
  updateItem: (item: InboxItem) => InboxItem | null;
}) {
  const {queryKey} = inboxItemsApiOptions(organization, filters);
  await queryClient.cancelQueries({queryKey});
  const previousData = queryClient.getQueryData(queryKey);

  queryClient.setQueryData(queryKey, prev =>
    prev
      ? {
          ...prev,
          pages: prev.pages.map(page => ({
            ...page,
            json: page.json.flatMap(item => {
              if (!isTargetedItem(item, target)) {
                return [item];
              }
              const updatedItem = updateItem(item);
              return updatedItem ? [updatedItem] : [];
            }),
          })),
        }
      : prev
  );

  return previousData;
}

function applyReadState(item: InboxItem, isRead: boolean): InboxItem {
  return {
    ...item,
    isUnread: !isRead,
    // The API clears the read timestamp when marking unread, so every event becomes unread
    unreadEventCount: isRead ? 0 : item.eventCount,
    lastReadAt: isRead ? new Date().toISOString() : null,
    latestEvent: {...item.latestEvent, isUnread: !isRead},
  };
}

/**
 * Updates the read state of, or restores, the targeted inbox items.
 */
export function updateInboxItemsMutationOptions({
  organization,
  filters,
  queryClient,
}: {
  filters: InboxFilters;
  organization: Organization;
  queryClient: QueryClient;
}) {
  const {queryKey} = inboxItemsApiOptions(organization, filters);

  return mutationOptions({
    mutationFn: ({update, ...target}: UpdateInboxItemsVariables) =>
      fetchMutation<{updatedCount: number}>({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/inbox/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        options: {query: getTargetQuery(target)},
        data: update,
      }),
    onMutate: async ({update, ...target}) => {
      const {isRead} = update;
      if (isRead === undefined) {
        return {previousData: undefined};
      }
      const previousData = await updateCachedInboxItems({
        organization,
        filters,
        queryClient,
        target,
        updateItem: item => applyReadState(item, isRead),
      });
      return {previousData};
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: (_data, _error, {update}) => {
      // Restored items are not in the cache, so the list has to be refetched to show them
      if (update.isRemoved === false) {
        queryClient.invalidateQueries({queryKey});
      }
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/inbox/count/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
    },
  });
}
