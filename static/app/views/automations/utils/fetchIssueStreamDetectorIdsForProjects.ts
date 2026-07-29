import type {QueryClient} from '@tanstack/react-query';
import chunk from 'lodash/chunk';

import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

const MAX_PROJECTS_PER_REQUEST = 100;

export async function fetchIssueStreamDetectorIdsForProjects({
  queryClient,
  organization,
  projectIds,
}: {
  organization: Organization;
  projectIds: string[];
  queryClient: QueryClient;
}): Promise<string[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const detectorPages = await Promise.all(
    chunk(projectIds, MAX_PROJECTS_PER_REQUEST).map(projectIdChunk =>
      queryClient.fetchQuery(
        detectorListApiOptions(organization, {
          query: 'type:issue_stream',
          includeIssueStreamDetectors: true,
          limit: MAX_PROJECTS_PER_REQUEST,
          projects: projectIdChunk.map(Number),
        })
      )
    )
  );
  const detectors = detectorPages.flatMap(page => page.json);

  return projectIds
    .map(projectId => detectors.find(detector => detector.projectId === projectId)?.id)
    .filter(defined);
}
