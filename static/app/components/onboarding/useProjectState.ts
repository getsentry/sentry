import type {Project} from 'sentry/types/project';
import {isProjectActive} from 'sentry/utils/projects';
import useOrganization from 'sentry/utils/useOrganization';

import {useRecentCreatedProject} from './useRecentCreatedProject';

/**
 * Hook to check if a project is active, using the most recent data if available.
 * Useful for deciding whether a project should be deleted.
 */
export function useProjectState(project: Project): Project & {active: boolean} {
  const organization = useOrganization();

  const recentCreatedProject = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (recentCreatedProject.project) {
    return {
      ...recentCreatedProject.project,
      active: recentCreatedProject.isProjectActive ?? false,
    };
  }

  return {
    ...project,
    active: isProjectActive(project),
  };
}
