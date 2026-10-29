import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {PLACEHOLDER_RUNS} from 'sentry/views/seerWorkflows/automations/runs/placeholderRuns';
import type {
  SeerAutomationRunStatus,
  SeerAutomationRunsResponse,
} from 'sentry/views/seerWorkflows/types';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

function isRunInProgress(status: SeerAutomationRunStatus) {
  return status === 'queued' || status === 'running';
}

/**
 * Fetches the organization's automation runs, newest first, polling while any run is
 * in progress. Pass `configId` to only fetch one automation's runs.
 */
export function useAutomationRuns({configId}: {configId?: string} = {}) {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  const {isError, refetch} = useQuery({
    ...apiOptions.as<SeerAutomationRunsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/runs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {config: configId},
        staleTime: 0,
      }
    ),
    // TEMPORARY: skip the runs API until it returns the new shape
    enabled: false,
    refetchInterval: query =>
      query.state.data?.json.runs.some(run => isRunInProgress(run.status)) ? 5000 : false,
  });

  // TEMPORARY: show placeholder runs until the new runs API ships
  return {runs: PLACEHOLDER_RUNS, isPending: false, isError, refetch};
}
