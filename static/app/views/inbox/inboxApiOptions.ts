import {
  mutationOptions,
  skipToken,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ListItemCheckboxState} from 'sentry/utils/list/useListItemCheckboxState';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {InboxFilters, InboxItem, InboxSubjectRef} from './types';

const INBOX_ITEMS_PER_PAGE = 25;

type InboxItemsUpdate = {
  isRead?: boolean;
  /**
   * Cancels a pending removal.
   */
  undoRemoval?: boolean;
};

/**
 * Items are targeted by subject when viewing a single item, since it may not be loaded,
 * or by checkbox selection for bulk actions.
 */
type InboxItemsTarget =
  | {subject: InboxSubjectRef}
  | {selection: ListItemCheckboxState['selectedIds']};

type UpdateInboxItemsVariables = InboxItemsTarget & {update: InboxItemsUpdate};

type RemoveInboxItemsTarget = {ids: string[]} | 'all-read';

type InboxListData = InfiniteData<ApiResponse<InboxItem[]>>;

export function inboxUnreadCountApiOptions(organization: Organization | null) {
  return {
    ...apiOptions.as<{count: number}>()(
      '/organizations/$organizationIdOrSlug/inbox/count/',
      {
        path: organization?.features.includes('universal-inbox')
          ? {organizationIdOrSlug: organization.slug}
          : skipToken,
        query: {is_read: 'false'},
        staleTime: 0,
      }
    ),
    refetchOnWindowFocus: 'always' as const,
  };
}

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
          ...(filters.recipient.length > 0 && {recipient: filters.recipient}),
        },
        staleTime: 30_000,
      }
    ),
    refetchOnWindowFocus: 'always' as const,
  };
}

function getTargetQuery(target: InboxItemsTarget) {
  if ('subject' in target) {
    return {subject_type: [target.subject.type], subject_id: target.subject.id};
  }
  return target.selection === 'all' ? {} : {id: target.selection};
}

function isTargetedItem(item: InboxItem, target: InboxItemsTarget) {
  if ('subject' in target) {
    return (
      item.subject.type === target.subject.type && item.subject.id === target.subject.id
    );
  }
  return target.selection === 'all' || target.selection.includes(item.id);
}

/**
 * Matches the cached inbox lists for every combination of filters.
 */
function getInboxListsFilter(organization: Organization) {
  return apiOptions.queryFilter('/organizations/$organizationIdOrSlug/inbox/', {
    path: {organizationIdOrSlug: organization.slug},
  });
}

/**
 * Optimistically updates the targeted items in every cached inbox list.
 * Returning null from `updateItem` drops the item from the list.
 */
async function updateCachedInboxItems({
  organization,
  queryClient,
  target,
  updateItem,
}: {
  organization: Organization;
  queryClient: QueryClient;
  target: InboxItemsTarget;
  updateItem: (item: InboxItem) => InboxItem | null;
}) {
  const filter = getInboxListsFilter(organization);
  await queryClient.cancelQueries(filter);

  queryClient.setQueriesData<InboxListData>(filter, prev =>
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

function getInboxCountFilter(organization: Organization) {
  return apiOptions.queryFilter('/organizations/$organizationIdOrSlug/inbox/count/', {
    path: {organizationIdOrSlug: organization.slug},
  });
}

export function removeInboxItemsMutationOptions({
  organization,
  queryClient,
}: {
  organization: Organization;
  queryClient: QueryClient;
}) {
  const filter = getInboxListsFilter(organization);

  return mutationOptions({
    mutationFn: (target: RemoveInboxItemsTarget) =>
      fetchMutation<void>({
        method: 'DELETE',
        url: getApiUrl('/organizations/$organizationIdOrSlug/inbox/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        options: {query: target === 'all-read' ? {is_read: 'true'} : {id: target.ids}},
      }),
    // Deleting read items depends on any read-state updates already in flight.
    scope: {id: `inbox-updates:${organization.id}`},
    onMutate: async target => {
      await updateCachedInboxItems({
        organization,
        queryClient,
        target: {selection: target === 'all-read' ? 'all' : target.ids},
        updateItem: item => (target === 'all-read' && item.isUnread ? item : null),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({...filter, refetchType: 'active'});
      queryClient.invalidateQueries(getInboxCountFilter(organization));
    },
  });
}

/**
 * Updates the read state of, or restores, the targeted inbox items.
 */
export function updateInboxItemsMutationOptions({
  organization,
  queryClient,
}: {
  organization: Organization;
  queryClient: QueryClient;
}) {
  const filter = getInboxListsFilter(organization);

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
    // Keep automatic and explicit read-state updates in the order they were requested.
    scope: {id: `inbox-updates:${organization.id}`},
    onMutate: async ({update, ...target}) => {
      const {isRead} = update;
      if (isRead === undefined) {
        return;
      }
      await updateCachedInboxItems({
        organization,
        queryClient,
        target,
        updateItem: item => applyReadState(item, isRead),
      });
    },
    onSettled: (_data, error, {update}) => {
      queryClient.invalidateQueries({
        ...filter,
        // Failed updates are refetched rather than restored from a snapshot, which could
        // overwrite overlapping updates. Restored items are not in the cache, so they only
        // show up after a refetch. Otherwise the read state is already applied, and lists
        // are only marked stale in case they loaded during the request.
        refetchType: error || update.undoRemoval ? 'active' : 'none',
      });
      queryClient.invalidateQueries(getInboxCountFilter(organization));
    },
  });
}
