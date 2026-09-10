import type {QueryClient} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {ALL_PROJECTS_DETECTOR_NAME} from 'sentry/views/automations/constants';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

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

  const {json: detectors} = await queryClient.fetchQuery(
    detectorListApiOptions(organization, {
      query: 'type:issue_stream',
      includeIssueStreamDetectors: true,
      projects: projectIds.map(Number),
    })
  );

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
