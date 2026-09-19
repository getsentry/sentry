import {Fragment} from 'react';
import {uuid4} from '@sentry/core';
import type {QueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import type {ResponsiveKey} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {toast} from '@sentry/scraps/toast';

import {bulkUpdate} from 'sentry/actionCreators/group';
import type {Client} from 'sentry/api';
import {IconRefresh} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import type {PageFilters} from 'sentry/types/core';
import {GroupStatus, type BaseGroup} from 'sentry/types/group';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {defined} from 'sentry/utils/defined';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {capitalize} from 'sentry/utils/string/capitalize';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

import {ExtraDescription} from './extraDescription';

export const BULK_LIMIT = 1000;
export const BULK_LIMIT_STR = BULK_LIMIT.toLocaleString();

export enum ConfirmAction {
  RESOLVE = 'resolve',
  UNRESOLVE = 'unresolve',
  ARCHIVE = 'archive',
  BOOKMARK = 'bookmark',
  UNBOOKMARK = 'unbookmark',
  MERGE = 'merge',
  DELETE = 'delete',
  SET_PRIORITY = 'reprioritize',
}

function getBulkConfirmMessage(action: string, queryCount: number) {
  if (queryCount > BULK_LIMIT) {
    return tct(
      'Are you sure you want to [action] the first [bulkNumber] issues that match the search?',
      {
        action,
        bulkNumber: BULK_LIMIT_STR,
      }
    );
  }

  return tct(
    'Are you sure you want to [action] all [bulkNumber] issues that match the search?',
    {
      action,
      bulkNumber: queryCount,
    }
  );
}

function PerformanceIssueAlert({
  allInQuerySelected,
  children,
}: {
  allInQuerySelected: boolean;
  children: string;
}) {
  if (!allInQuerySelected) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="info">{children}</Alert>
    </Alert.Container>
  );
}

export function getConfirm({
  numIssues,
  allInQuerySelected,
  query,
  queryCount,
}: {
  allInQuerySelected: boolean;
  numIssues: number;
  query: string;
  queryCount: number;
}) {
  return function ({
    action,
    canBeUndone,
    append = '',
  }: {
    action: ConfirmAction;
    canBeUndone: boolean;
    append?: string;
  }) {
    const question = allInQuerySelected
      ? getBulkConfirmMessage(`${action}${append}`, queryCount)
      : tn(
          // Use sprintf argument swapping since the number value must come
          // first. See https://github.com/alexei/sprintf.js#argument-swapping
          'Are you sure you want to %2$s this %s issue%3$s?',
          'Are you sure you want to %2$s these %s issues%3$s?',
          numIssues,
          action,
          append
        );

    let message: React.ReactNode;
    switch (action) {
      case ConfirmAction.DELETE:
        message = (
          <Fragment>
            <p>
              {tct(
                'Bulk deletion is only recommended for junk data. To clear your stream, consider resolving or ignoring. [link:When should I delete events?]',
                {
                  link: (
                    <ExternalLink href="https://www.sentry.help/en/articles/13964890-when-should-i-delete-events" />
                  ),
                }
              )}
            </p>
            <PerformanceIssueAlert allInQuerySelected={allInQuerySelected}>
              {t('Deleting performance issues is not yet supported and will be skipped.')}
            </PerformanceIssueAlert>
          </Fragment>
        );
        break;
      case ConfirmAction.MERGE:
        message = (
          <Fragment>
            <p>{t('Note that unmerging is currently an experimental feature.')}</p>
            <PerformanceIssueAlert allInQuerySelected={allInQuerySelected}>
              {t('Merging performance issues is not yet supported and will be skipped.')}
            </PerformanceIssueAlert>
          </Fragment>
        );
        break;
      default:
        message = canBeUndone ? null : <p>{t('This action cannot be undone.')}</p>;
    }

    return (
      <div>
        <p style={{marginBottom: '20px'}}>
          <strong>{question}</strong>
        </p>
        <ExtraDescription
          all={allInQuerySelected}
          query={query}
          queryCount={queryCount}
        />
        {message}
      </div>
    );
  };
}

export function getLabel(numIssues: number, allInQuerySelected: boolean) {
  return function (action: string, append = '') {
    const capitalized = capitalize(action);
    const text = allInQuerySelected
      ? t('Bulk %s issues', action)
      : // Use sprintf argument swapping to put the capitalized string first. See
        // https://github.com/alexei/sprintf.js#argument-swapping
        tn('%2$s %s selected issue', '%2$s %s selected issues', numIssues, capitalized);

    return text + append;
  };
}

// The container breakpoint at which each issue-list column becomes visible.
export const COLUMN_BREAKPOINTS = {
  ISSUE: undefined, // Issue column is always visible
  TREND: 'xl',
  LAST_SEEN: 'sm',
  FIRST_SEEN: '2xl',
  EVENTS: 'lg',
  USERS: '2xl',
  PRIORITY: '4xl',
  PROGRESS: '2xs',
  ASSIGNEE: 'sm',
} as const satisfies Record<string, ResponsiveKey | undefined>;

function getSelectedProjectIds({
  selectedGroupIds,
  selection,
}: {
  selectedGroupIds: string[] | undefined;
  selection: PageFilters;
}) {
  if (!selectedGroupIds) {
    return selection.projects;
  }

  const groups = selectedGroupIds.map(id => GroupStore.get(id));
  const projectIds = new Set(groups.map(group => group?.project?.id).filter(defined));

  if (projectIds.size === 1) {
    return [...projectIds];
  }

  return selection.projects;
}

export function invalidateIssueQueries({
  itemIds,
  organizationSlug,
  queryClient,
}: {
  itemIds: string[] | undefined;
  organizationSlug: string;
  queryClient: QueryClient;
}) {
  if (itemIds?.length) {
    for (const itemId of itemIds) {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organizationSlug}/issues/${itemId}/`],
        exact: false,
      });
    }
    return;
  }

  queryClient.invalidateQueries({
    predicate: apiQuery => {
      const queryKey = safeParseQueryKey(apiQuery.queryKey);
      if (!queryKey) {
        return false;
      }
      return queryKey.url.startsWith(`/organizations/${organizationSlug}/issues/`);
    },
  });
}

function getBulkActionMessages(
  data: IssueUpdateData | Record<string, unknown>,
  itemIds: string[] | undefined
) {
  const count = itemIds?.length;
  const target =
    itemIds?.length === 1
      ? (GroupStore.get(itemIds[0]!)?.shortId ?? t('1 issue'))
      : tn('%s issue', '%s issues', count ?? 0);

  if ('status' in data && data.status === GroupStatus.RESOLVED) {
    return {
      loading: t('Resolving issues…'),
      success:
        count === undefined ? t('Selected issues resolved') : t('Resolved %s', target),
      error: t('Unable to resolve issues'),
    };
  }
  if ('status' in data && data.status === GroupStatus.IGNORED) {
    return {
      loading: t('Archiving issues…'),
      success:
        count === undefined ? t('Selected issues archived') : t('Archived %s', target),
      error: t('Unable to archive issues'),
    };
  }
  if ('status' in data && data.status === GroupStatus.UNRESOLVED) {
    return {
      loading: t('Unresolving issues…'),
      success:
        count === undefined
          ? t('Selected issues unresolved')
          : t('Unresolved %s', target),
      error: t('Unable to unresolve issues'),
    };
  }
  if ('inbox' in data && !data.inbox) {
    return {
      loading: t('Marking issues reviewed…'),
      success:
        count === undefined ? t('Selected issues reviewed') : t('Reviewed %s', target),
      error: t('Unable to mark issues reviewed'),
    };
  }
  if ('priority' in data) {
    return {
      loading: t('Updating issue priority…'),
      success:
        count === undefined
          ? t('Selected issues reprioritized')
          : t('Reprioritized %s', target),
      error: t('Unable to update issue priority'),
    };
  }
  return {
    loading: t('Saving changes…'),
    success: t('Changes saved'),
    error: t('Unable to update issues'),
  };
}

export function performBulkUpdate({
  api,
  data,
  itemIds,
  organizationSlug,
  query,
  selection,
  onError,
  onSuccess,
}: {
  api: Client;
  data: IssueUpdateData | Record<string, unknown>;
  itemIds: string[] | undefined;
  organizationSlug: string;
  query: string;
  selection: PageFilters;
  onError?: () => void;
  onSuccess?: (
    itemIds: string[] | undefined,
    previousGroups: BaseGroup[]
  ) => (() => void) | void;
}) {
  if (itemIds?.length === 0) {
    return;
  }

  const projectConstraints = {
    project: getSelectedProjectIds({selectedGroupIds: itemIds, selection}),
  };

  const previousGroups = itemIds?.map(id => GroupStore.get(id)).filter(defined) ?? [];
  const messages = getBulkActionMessages(data, itemIds);
  const toastId = toast.loading(messages.loading, {
    id: uuid4(),
    duration: 30_000,
  });

  bulkUpdate(
    api,
    {
      orgId: organizationSlug,
      itemIds,
      data,
      query,
      environment: selection.environments,
      failSilently: true,
      ...projectConstraints,
      ...selection.datetime,
    },
    {
      success: () => {
        const undo = onSuccess?.(itemIds, previousGroups);
        toast.success(messages.success, {
          id: toastId,
          action: undo
            ? {label: t('Undo'), icon: <IconRefresh size="xs" />, onClick: undo}
            : undefined,
        });
      },
      error: () => {
        toast.error(
          isDemoModeActive()
            ? t('This action is not allowed in demo mode.')
            : messages.error,
          {id: toastId}
        );
        onError?.();
      },
    }
  );
}
