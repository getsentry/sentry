import type {QueryClient} from '@tanstack/react-query';
import chunk from 'lodash/chunk';

import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {ALL_PROJECTS_DETECTOR_NAME} from 'sentry/views/automations/constants';
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

export async function fetchAllProjectsDetectorId({
  queryClient,
  organization,
}: {
  organization: Organization;
  queryClient: QueryClient;
}): Promise<string | undefined> {
  const {json: detectors} = await queryClient.fetchQuery(
    detectorListApiOptions(organization, {
      type: 'issue_stream',
      query: `name:"${ALL_PROJECTS_DETECTOR_NAME}"`,
      includeIssueStreamDetectors: true,
      limit: 1,
    })
  );

  return detectors.find(detector => detector.projectId === null)?.id;
}
