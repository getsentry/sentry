import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import type {Project} from 'sentry/types/project';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';

export function getAvailableEnvironments(
  projects: Project[],
  projectSelection: ReadonlySet<number>
): Set<string> {
  const isSuperuser = isActiveSuperuser();
  const includeAllProjects = projectSelection.has(ALL_ACCESS_PROJECTS);
  const includeMemberProjects = projectSelection.size === 0;
  const result = new Set<string>();

  for (const project of projects) {
    const projectId = parseInt(project.id, 10);
    if (
      (includeAllProjects && project.hasAccess) ||
      (includeMemberProjects && (project.isMember || isSuperuser)) ||
      projectSelection.has(projectId)
    ) {
      for (const environment of project.environments) {
        result.add(environment);
      }
    }
  }

  return result;
}
