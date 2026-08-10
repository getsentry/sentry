import {useQuery} from '@tanstack/react-query';

import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

/**
 * Returns the ID of the issue stream detector for a given project.
 * Issue stream detectors are used to connect automations to "all issues in a project".
 */
export function useIssueStreamDetectorsForProject(projectId: string | null | undefined) {
  const organization = useOrganization();
  const hasProject = defined(projectId);
  return useQuery({
    ...detectorListApiOptions(organization, {
      query: 'type:issue_stream',
      projects: hasProject ? [Number(projectId)] : [],
      includeIssueStreamDetectors: true,
    }),
    staleTime: Infinity,
    enabled: hasProject,
  });
}
