import {useQuery} from '@tanstack/react-query';

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

export function useIssueAutofixEnrichment(issueId: string): IssueAutofixEnrichment {
  const organization = useOrganization();

  const runsQuery = useQuery({
    ...apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
      path: {organizationIdOrSlug: organization.slug},
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

  return {
    run: runsQuery.data?.find(run => run.groupId === issueId) ?? null,
    state: stateQuery.data?.autofix ?? null,
    statePending: stateQuery.isPending,
    enrichmentPending: stateQuery.isPending || runsQuery.isPending,
  };
}
