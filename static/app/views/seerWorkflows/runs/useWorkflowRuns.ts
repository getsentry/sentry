import {useMemo, useRef} from 'react';
import * as Sentry from '@sentry/react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {apiFetch} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {SeerWorkflowRun, WorkflowStrategy} from 'sentry/views/seerWorkflows/types';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

function isSupportedStrategy(strategy: string): strategy is WorkflowStrategy {
  return Object.hasOwn(STRATEGY_META, strategy);
}

/**
 * Fetches the organization's workflow runs, polling while any run is in progress.
 * `runs` only includes runs with a strategy the frontend knows how to display.
 */
export function useWorkflowRuns() {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  const reportedStrategies = useRef(new Set<string>());
  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<SeerWorkflowRun[]>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/runs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        staleTime: 0,
      }
    ),
    queryFn: automationsEnabled
      ? async context => {
          const response = await apiFetch<SeerWorkflowRun[]>(context);
          for (const {strategy} of response.json) {
            if (
              isSupportedStrategy(strategy) ||
              reportedStrategies.current.has(strategy)
            ) {
              continue;
            }
            reportedStrategies.current.add(strategy);
            Sentry.captureMessage('Unsupported Seer workflow strategy', {
              level: 'warning',
              extra: {strategy},
            });
          }
          return response;
        }
      : skipToken,
    refetchInterval: query =>
      query.state.data?.json.some(
        run => isSupportedStrategy(run.strategy) && run.extras.status === 'running'
      )
        ? 5000
        : false,
  });

  const runs = useMemo(
    () => data?.filter(run => isSupportedStrategy(run.strategy)) ?? [],
    [data]
  );

  return {data, runs, isPending, isError, refetch};
}
