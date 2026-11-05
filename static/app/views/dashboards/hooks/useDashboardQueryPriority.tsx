import {createContext, useContext, type ReactNode} from 'react';
import {mutationOptions, useMutation, useQueryClient} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  DashboardDetails,
  DashboardQueryPriority,
} from 'sentry/views/dashboards/types';
import {flattenErrors} from 'sentry/views/dashboards/utils';
import {
  SAMPLING_MODE,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';

import {getDashboardRevisionsQueryKey} from './useDashboardRevisions';

const DASHBOARD_QUERY_PRIORITIES = [
  'normal',
  'faster',
] as const satisfies readonly DashboardQueryPriority[];

const DASHBOARD_QUERY_PRIORITY_OPTIONS: Array<{
  details: string;
  label: string;
  value: DashboardQueryPriority;
}> = [
  {
    value: 'normal',
    label: t('Balanced Querying'),
    details: t('Balances speed and accuracy'),
  },
  {
    value: 'faster',
    label: t('Fast Querying'),
    details: t('Faster with reduced accuracy'),
  },
];

// No default: an absent param must stay null so a saved dashboard priority can
// apply. `withDefault('normal')` would hide that saved value.
const queryPriorityParser = parseAsStringLiteral(DASHBOARD_QUERY_PRIORITIES);

const SavedDashboardQueryPriorityContext = createContext<
  DashboardQueryPriority | undefined
>(undefined);

export function SavedDashboardQueryPriorityProvider({
  children,
  priority,
}: {
  children: ReactNode;
  priority?: DashboardQueryPriority;
}) {
  return (
    <SavedDashboardQueryPriorityContext value={priority}>
      {children}
    </SavedDashboardQueryPriorityContext>
  );
}

export function isDashboardQueryPriority(
  value: unknown
): value is DashboardQueryPriority {
  return value === 'normal' || value === 'faster';
}

/** Real dashboards use a numeric id. Prebuilt placeholders must not be saved. */
export function isSavedDashboardId(id: string | undefined): id is string {
  return !!id && /^\d+$/.test(id);
}

export function useDashboardQueryPriority(savedPriority?: DashboardQueryPriority) {
  const organization = useOrganization();
  const enabled = organization.features.includes('low-priority-queries');
  const contextPriority = useContext(SavedDashboardQueryPriorityContext);
  const [urlPriority, setUrlPriority] = useQueryState(
    'queryPriority',
    queryPriorityParser
  );
  const priority = enabled
    ? (urlPriority ?? savedPriority ?? contextPriority ?? 'normal')
    : 'normal';

  return {
    enabled,
    options: DASHBOARD_QUERY_PRIORITY_OPTIONS,
    priority,
    setPriority: (value: DashboardQueryPriority) => {
      if (enabled) {
        setUrlPriority(value);
      }
    },
  };
}

type SaveDashboardQueryPriorityVariables = {
  dashboardId: string;
  queryPriority: DashboardQueryPriority;
};

/**
 * Saves the dashboard query priority without touching anything else on it.
 *
 * The endpoint rewrites widgets when the payload carries a `widgets` key, so
 * this sends only `queryPriority`. A full dashboard save would race any
 * concurrent edit and could clobber widgets with a stale copy. Every write
 * snapshots a revision, so refresh that list after a successful save.
 */
function useSaveDashboardQueryPriorityMutationOptions() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: ({dashboardId, queryPriority}: SaveDashboardQueryPriorityVariables) =>
      fetchMutation<DashboardDetails>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/dashboards/$dashboardId/', {
          path: {organizationIdOrSlug: organization.slug, dashboardId},
        }),
        method: 'PUT',
        data: {queryPriority},
      }),
    onSuccess: updated => {
      queryClient.invalidateQueries({
        queryKey: getDashboardRevisionsQueryKey(organization.slug, updated.id),
      });
    },
    onError: (error: unknown) => {
      const errorResponse = error instanceof RequestError ? error.responseJSON : null;
      const errors = errorResponse ? flattenErrors(errorResponse, {}) : {};
      const message = errors[Object.keys(errors)[0] ?? ''];
      toast.error(
        typeof message === 'string' ? message : t('Unable to update query priority')
      );
    },
  });
}

export function useSaveDashboardQueryPriority() {
  return useMutation(useSaveDashboardQueryPriorityMutationOptions());
}

// One chain for every dashboard PUT. A full save loads `query_priority` when
// the request starts and writes that value back when the field is omitted, so
// it must not run beside a priority save. A failed write does not block the
// next one; the caller still sees that failure.
let dashboardWriteQueue: Promise<unknown> = Promise.resolve();

export function enqueueDashboardWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = dashboardWriteQueue.then(task);
  dashboardWriteQueue = run.catch(() => {});
  return run;
}

/**
 * Dashboard query priority. Normal keeps the caller's existing sampling mode.
 * Faster sends `sampling=LOW_PRIORITY`, and only when the
 * `low-priority-queries` flag is enabled.
 */
export function useDashboardSamplingMode(
  fallback: SamplingMode | undefined
): SamplingMode | undefined {
  const {priority} = useDashboardQueryPriority();
  if (priority === 'faster') {
    return SAMPLING_MODE.LOW_PRIORITY;
  }
  return fallback;
}
