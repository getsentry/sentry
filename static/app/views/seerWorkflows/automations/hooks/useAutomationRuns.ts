import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  SeerAutomationRunStatus,
  SeerAutomationRunsResponse,
} from 'sentry/views/seerWorkflows/types';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

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
    ...apiOptions.as<SeerAutomationRunsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/runs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {config: configId, cursor, per_page: perPage},
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
    refetchInterval: query =>
      query.state.data?.json.runs.some(run => isRunInProgress(run.status)) ? 5000 : false,
  });

  return {
    runs: data?.json.runs ?? [],
    pageLinks: data?.headers.Link,
    isPending,
    isLoadingError,
    refetch,
  };
}

function isRunInProgress(status: SeerAutomationRunStatus) {
  return status === 'queued' || status === 'running';
}
