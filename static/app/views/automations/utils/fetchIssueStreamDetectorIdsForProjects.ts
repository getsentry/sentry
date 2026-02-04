import type {QueryClient} from '@tanstack/react-query';

import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {fetchDataQuery} from 'sentry/utils/queryClient';
import {makeDetectorListQueryKey} from 'sentry/views/detectors/hooks';

export async function fetchIssueStreamDetectorIdsForProjects({
  queryClient,
  orgSlug,
  projectIds,
}: {
  orgSlug: string;
  projectIds: string[];
  queryClient: QueryClient;
}): Promise<string[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const [detectors] = await queryClient.fetchQuery({
    queryKey: makeDetectorListQueryKey({
      orgSlug,
      query: 'type:issue_stream',
      includeIssueStreamDetectors: true,
      projects: projectIds.map(Number),
    }),
    queryFn: fetchDataQuery<Detector[]>,
    staleTime: 0,
  });

  return projectIds
    .map(projectId => detectors.find(detector => detector.projectId === projectId)?.id)
    .filter(defined);
}
