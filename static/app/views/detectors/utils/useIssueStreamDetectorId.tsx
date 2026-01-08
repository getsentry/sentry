import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

/**
 * Returns the ID of the issue stream detector for a given project.
 * Issue stream detectors are used to connect automations to "all issues in a project".
 */
export function useIssueStreamDetectorId(projectId: string | undefined): string | null {
  const {data: issueStreamDetectors} = useDetectorsQuery({
    query: 'type:issue_stream',
    projects: [Number(projectId)],
    includeIssueStreamDetectors: true,
  });

  return issueStreamDetectors?.[0]?.id ?? null;
}
