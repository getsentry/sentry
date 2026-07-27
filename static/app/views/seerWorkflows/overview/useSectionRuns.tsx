import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {RUN_QUESTION_PROMPTS} from './runQuestions';
import {QUERY_STALE_TIME, RUNS_QUERY, type SeerRun} from './types';

export function useSectionRuns(groupIds: string[]): {
  runMap: Map<string, SeerRun>;
  runsPending: boolean;
} {
  const organization = useOrganization();

  const query = useQuery(
    apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
      path: groupIds.length ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        query: `${RUNS_QUERY} group:[${groupIds.join(', ')}]`,
        question: RUN_QUESTION_PROMPTS,
        per_page: groupIds.length,
      },
      staleTime: QUERY_STALE_TIME,
    })
  );

  const runMap = useMemo(() => {
    const map = new Map<string, SeerRun>();
    for (const run of query.data ?? []) {
      if (!run.groupId) {
        continue;
      }
      const existing = map.get(run.groupId);
      if (!existing || run.lastTriggeredAt > existing.lastTriggeredAt) {
        map.set(run.groupId, run);
      }
    }
    return map;
  }, [query.data]);

  return {runMap, runsPending: groupIds.length ? query.isPending : false};
}
