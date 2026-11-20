import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';

import {agenticProgressRunOptions} from './api';

const POLL_INTERVAL_MS = 5000;

type UseAgenticProgressOptions = {
  runId: string | null;
  enabled?: boolean;
};

export function useAgenticProgress({runId, enabled = true}: UseAgenticProgressOptions) {
  const organization = useOrganization();
  const queryEnabled = enabled && runId !== null;

  return useQuery({
    ...agenticProgressRunOptions({
      organizationSlug: organization.slug,
      runId: queryEnabled ? runId : null,
    }),
    enabled: queryEnabled,
    // The backend sets continueUpdates to false once the run reaches a terminal state,
    // after which the run can no longer change.
    refetchInterval: query =>
      query.state.data?.json.continueUpdates === false ? false : POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}
