import ProjectsStore from 'sentry/stores/projectsStore';

interface Options {
  enabled?: boolean;
  projectId?: string[];
}

/**
 * Returns a list of projects that are not eligible for span metrics
 * because they were denylisted.
 *
 * @param options Additional options
 * @param options.projectId List of project IDs to check against. If omitted, checks all organization projects
 * @returns List of projects
 */
export function useDenylistedProjects(options?: Options) {
  const projects = (options?.projectId ?? [])
    .map(projectId => {
      return ProjectsStore.getById(projectId);
    })
    .filter(project => {
      return !project?.features.includes('span-metrics-extraction');
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    projects,
  };
}
