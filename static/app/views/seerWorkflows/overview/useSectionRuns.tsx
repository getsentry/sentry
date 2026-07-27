import {useQueries} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {RUN_QUESTION_PROMPTS} from './runQuestions';
import {QUERY_STALE_TIME, RUNS_QUERY, type SeerRun} from './types';

// Requesting `question` outputs caps the endpoint at max_per_page=10, and it
// raises a 400 rather than clamping, so ids are fetched in chunks of ten.
const RUNS_PER_PAGE = 10;

export function useSectionRuns(groupIds: string[]): {
  runMap: Map<string, SeerRun>;
  runsPending: boolean;
} {
  const organization = useOrganization();

  const chunks: string[][] = [];
  for (let index = 0; index < groupIds.length; index += RUNS_PER_PAGE) {
    chunks.push(groupIds.slice(index, index + RUNS_PER_PAGE));
  }

  return useQueries({
    queries: chunks.map(chunk => ({
      ...apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: `${RUNS_QUERY} group:[${chunk.join(', ')}]`,
          question: RUN_QUESTION_PROMPTS,
          per_page: chunk.length,
        },
        staleTime: QUERY_STALE_TIME,
      }),
    })),
    combine: results => {
      const runMap = new Map<string, SeerRun>();
      for (const result of results) {
        for (const run of result.data ?? []) {
          if (!run.groupId) {
            continue;
          }
          const existing = runMap.get(run.groupId);
          if (!existing || run.lastTriggeredAt > existing.lastTriggeredAt) {
            runMap.set(run.groupId, run);
          }
        }
      }
      return {
        runMap,
        runsPending: results.some(result => result.isPending),
      };
    },
  });
}
