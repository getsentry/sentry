import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';

import {agenticProgressRunOptions} from './api';

const POLL_INTERVAL_MS = 5000;

type UseAgenticProgressOptions = {
  runId: string | null;
};

export function useAgenticProgress({runId}: UseAgenticProgressOptions) {
  const organization = useOrganization();
  const queryEnabled = runId !== null;

  return useQuery({
    ...agenticProgressRunOptions({
      organizationSlug: organization.slug,
      runId: queryEnabled ? runId : null,
    }),
    enabled: queryEnabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}
