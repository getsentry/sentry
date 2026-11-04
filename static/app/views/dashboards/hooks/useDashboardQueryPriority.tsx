import {createContext, useContext, type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {updateDashboardQueryPriority} from 'sentry/actionCreators/dashboards';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardQueryPriority} from 'sentry/views/dashboards/types';
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
  {value: 'normal', label: t('Normal'), details: t('Balance speed and accuracy')},
  {value: 'faster', label: t('Faster'), details: t('Faster with reduced accuracy')},
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
    <SavedDashboardQueryPriorityContext.Provider value={priority}>
      {children}
    </SavedDashboardQueryPriorityContext.Provider>
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

/**
 * Persists the dropdown selection. Every write snapshots a revision, so refresh
 * that list after a successful save.
 */
export function useSaveDashboardQueryPriority() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return (dashboardId: string, queryPriority: DashboardQueryPriority) =>
    updateDashboardQueryPriority(organization.slug, dashboardId, queryPriority).then(
      updated => {
        queryClient.invalidateQueries({
          queryKey: getDashboardRevisionsQueryKey(organization.slug, updated.id),
        });
        return updated;
      }
    );
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
