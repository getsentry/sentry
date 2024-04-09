import useProjects from 'sentry/utils/useProjects';

interface Options {
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
export function useDenylistedProjects(options: Options = {}) {
  const {projects, fetching} = useProjects();

  const {projectId = []} = options;

  const shouldCheckAllProjects = projectId.length === 0 || projectId.includes('-1');

  const projectsToCheck = shouldCheckAllProjects
    ? projects
    : projects.filter(project => projectId.includes(project.id.toString()));

  const denylistedProjects = projectsToCheck
    .filter(project => {
      return !project.features.includes('span-metrics-extraction');
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    projects: denylistedProjects,
    isFetching: fetching,
  };
}
