import {useQuery} from '@tanstack/react-query';

import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import {agenticProgressRunOptions} from './api';

const POLL_INTERVAL_MS = 5000;

type UseAgenticProgressOptions = {runId: string | null; enabled?: boolean};

export function useAgenticProgress({runId, enabled = true}: UseAgenticProgressOptions) {
  const organization = useOrganization();
  const queryEnabled = enabled && runId !== null;

  return useQuery({
    ...agenticProgressRunOptions({
      organizationSlug: organization.slug,
      runId: queryEnabled ? runId : null,
    }),
    enabled: queryEnabled,
    // Neither a finished run (continueUpdates is false) nor an expired run (404) can change
    // again. A failed request keeps the last good data, so the 404 is checked separately.
    refetchInterval: query => {
      const {data, error} = query.state;
      if (error instanceof RequestError && error.status === 404) {
        return false;
      }
      return data?.json.continueUpdates === false ? false : POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: true,
  });
}
