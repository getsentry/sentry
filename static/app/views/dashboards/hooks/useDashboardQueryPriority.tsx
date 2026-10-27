import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {useOrganization} from 'sentry/utils/useOrganization';
import {
  SAMPLING_MODE,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';

const DASHBOARD_QUERY_PRIORITIES = ['normal', 'low'] as const;

type DashboardQueryPriority = (typeof DASHBOARD_QUERY_PRIORITIES)[number];

const queryPriorityParser = parseAsStringLiteral(DASHBOARD_QUERY_PRIORITIES).withDefault(
  'normal'
);

export function useDashboardQueryPriority() {
  const organization = useOrganization();
  const enabled = organization.features.includes('low-priority-queries');
  const [priority, setPriority] = useQueryState('queryPriority', queryPriorityParser);

  return {
    enabled,
    priority: enabled ? priority : 'normal',
    setPriority: (value: DashboardQueryPriority) => {
      if (enabled) {
        setPriority(value);
      }
    },
  };
}

/**
 * Dashboard query priority. Normal keeps the caller's existing sampling mode.
 * Low priority sends `sampling=LOW_PRIORITY`, and only when the
 * `low-priority-queries` flag is enabled.
 */
export function useDashboardSamplingMode(
  fallback: SamplingMode | undefined
): SamplingMode | undefined {
  const {priority} = useDashboardQueryPriority();
  if (priority === 'low') {
    return SAMPLING_MODE.LOW_PRIORITY;
  }
  return fallback;
}
