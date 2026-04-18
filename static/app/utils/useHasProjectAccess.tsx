import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

type Options = {
  /**
   * When true, superusers must also be a project member to count as having access.
   */
  superuserNeedsToBeProjectMember?: boolean;
};

/**
 * Returns whether the current user has access to at least one project,
 * and whether the project list has finished loading.
 */
export function useHasProjectAccess(options?: Options) {
  const user = useUser();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const hasProjectAccess =
    user.isSuperuser && !options?.superuserNeedsToBeProjectMember
      ? !!projects?.some(p => p.hasAccess)
      : !!projects?.some(p => p.isMember && p.hasAccess);

  return {hasProjectAccess, projectsLoaded};
}
