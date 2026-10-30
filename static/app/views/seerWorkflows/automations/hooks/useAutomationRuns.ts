import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  PLACEHOLDER_RUNS,
  USE_PLACEHOLDER_RUNS,
} from 'sentry/views/seerWorkflows/automations/runs/placeholderRuns';
import type {SeerAutomationRunStatus} from 'sentry/views/seerWorkflows/types';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

function isRunInProgress(status: SeerAutomationRunStatus) {
  return status === 'queued' || status === 'running';
}

/**
 * Fetches a page of the organization's automation runs, newest first, polling while
 * any run is in progress. Pass `configId` to only fetch one automation's runs.
 */
export function useAutomationRuns({
  configId,
  cursor,
  perPage = 20,
}: {configId?: string; cursor?: string; perPage?: number} = {}) {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  const {data, isPending, isLoadingError, refetch} = useQuery({
    ...apiOptions.contract('/organizations/$organizationIdOrSlug/seer/workflows/runs/', {
      path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {config: configId, cursor, per_page: perPage},
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
    // TEMPORARY: skip the runs API until it returns the new shape
    enabled: !USE_PLACEHOLDER_RUNS,
    refetchInterval: query =>
      query.state.data?.json.runs.some(run => isRunInProgress(run.status)) ? 5000 : false,
  });

  // TEMPORARY: show placeholder runs until the new runs API ships
  if (USE_PLACEHOLDER_RUNS) {
    return {
      runs: configId
        ? PLACEHOLDER_RUNS.filter(run => run.configId === configId)
        : PLACEHOLDER_RUNS,
      pageLinks: undefined,
      isPending: false,
      isLoadingError,
      refetch,
    };
  }

  return {
    runs: data?.json.runs ?? [],
    pageLinks: data?.headers.Link,
    isPending,
    isLoadingError,
    refetch,
  };
}
