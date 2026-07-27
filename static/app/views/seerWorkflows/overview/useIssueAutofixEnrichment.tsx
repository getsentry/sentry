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
  // batchPending is required whenever options are passed: an omitted flag reads
  // as "settled" for pending and as "batched" for fallback, leaving a card
  // permanently blank with no request in flight.
  options?: {batchPending: boolean; injectedRun?: SeerRun | null}
): IssueAutofixEnrichment {
  const organization = useOrganization();

  // Batched callers must wait for their batch to settle before falling back:
  // while it is in flight every group looks absent, so firing here would double
  // every card's runs request. Once settled, a still-absent group (the rare
  // multi-run miss) fetches its own. Callers without options have no batch.
  const fallbackActive = !options || (!options.batchPending && !options.injectedRun);

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
  const run = options?.injectedRun ?? fallbackRun;

  return {
    run,
    state: stateQuery.data?.autofix ?? null,
    statePending: stateQuery.isPending,
    enrichmentPending:
      stateQuery.isPending ||
      options?.batchPending === true ||
      (fallbackActive && runsQuery.isPending),
  };
}
