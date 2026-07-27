import {skipToken, useQuery} from '@tanstack/react-query';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {RUN_QUESTION_PROMPTS} from './runQuestions';
import {QUERY_STALE_TIME, RUNS_QUERY, type SeerRun} from './types';

interface IssueAutofixEnrichment {
  enrichmentPending: boolean;
  run: SeerRun | null;
  state: ExplorerAutofixState | null;
  statePending: boolean;
}

export function useIssueAutofixEnrichment(
  issueId: string,
  options?: {injectedRun?: SeerRun | null; runMissing?: boolean}
): IssueAutofixEnrichment {
  const organization = useOrganization();

  // Fire the per-card runs query only when no batched run was injected
  // (focus mode, or the rare batch miss when a group has multiple runs).
  const fallbackActive = !options || options.runMissing === true;

  const runsQuery = useQuery({
    ...apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
      path: fallbackActive ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        query: `${RUNS_QUERY} group:${issueId}`,
        question: RUN_QUESTION_PROMPTS,
        per_page: 1,
      },
      staleTime: QUERY_STALE_TIME,
    }),
  });

  const stateQuery = useQuery({
    ...apiOptions.as<{autofix: ExplorerAutofixState | null}>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
      {
        path: {organizationIdOrSlug: organization.slug, issueId},
        query: {mode: 'explorer'},
        staleTime: QUERY_STALE_TIME,
      }
    ),
  });

  const fallbackRun = runsQuery.data?.find(run => run.groupId === issueId) ?? null;
  const run = fallbackActive ? fallbackRun : (options?.injectedRun ?? null);

  return {
    run,
    state: stateQuery.data?.autofix ?? null,
    statePending: stateQuery.isPending,
    enrichmentPending: stateQuery.isPending || (fallbackActive && runsQuery.isPending),
  };
}
