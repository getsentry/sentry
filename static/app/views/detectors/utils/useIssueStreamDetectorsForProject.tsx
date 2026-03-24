import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

/**
 * Returns the ID of the issue stream detector for a given project.
 * Issue stream detectors are used to connect automations to "all issues in a project".
 */
export function useIssueStreamDetectorsForProject(projectId: string | undefined) {
  return useDetectorsQuery({
    query: 'type:issue_stream',
    projects: [Number(projectId)],
    includeIssueStreamDetectors: true,
  });
}
