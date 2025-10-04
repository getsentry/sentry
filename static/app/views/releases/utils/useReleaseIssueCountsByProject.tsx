import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ReleaseProject} from 'sentry/types/release';
import {useApiQueries} from 'sentry/utils/queryClient';

interface UseReleaseIssueCountsByProjectOptions {
  organization: Organization;
  projects: ReleaseProject[];
  releaseVersion: string;
  selection: PageFilters;
  issueQuery?: string;
}

/**
 * Fetch issue counts for projects in a release
 * Returns a map of project ID to issue count
 *
 * Note: Counts are limited to 100 per project due to API constraints.
 */
export function useReleaseIssueCountsByProject({
  organization,
  projects,
  releaseVersion,
  selection,
  issueQuery = `first-release:"${releaseVersion}"`,
}: UseReleaseIssueCountsByProjectOptions): Record<number, number> {
  // Only include projects that are both in the release AND in the selected projects
  const validProjects =
    selection.projects.length > 0 && !selection.projects.includes(-1)
      ? projects.filter(p => selection.projects.includes(p.id))
      : projects;

  const issueCountQueryKeys = validProjects.map(
    project =>
      [
        `/organizations/${organization.slug}/issues-count/`,
        {
          query: {
            query: [issueQuery],
            project: [project.id],
            environment: selection.environments,
            statsPeriod: selection.datetime.period,
            start: selection.datetime.start
              ? new Date(selection.datetime.start).toISOString()
              : undefined,
            end: selection.datetime.end
              ? new Date(selection.datetime.end).toISOString()
              : undefined,
          },
        },
      ] as const
  );

  const issueCountResults = useApiQueries<Record<string, number>>(issueCountQueryKeys, {
    staleTime: 180000, // 3 minutes
  });

  // Map project ID to new issue count
  const issueCountsByProject = validProjects.reduce(
    (acc, project, index) => {
      const result = issueCountResults[index];
      acc[project.id] = result?.data?.[issueQuery] || 0;
      return acc;
    },
    {} as Record<number, number>
  );

  return issueCountsByProject;
}
