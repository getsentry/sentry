import {useProjects} from 'sentry/utils/useProjects';

type Options = {
  /**
   * When true, the user must be an explicit member of a project they have
   * access to. Use this for views that cannot render anything useful without
   * team membership.
   */
  superuserNeedsToBeProjectMember?: boolean;
};

/**
 * Returns whether the current user has access to at least one project,
 * and whether the project list has finished loading.
 */
export function useHasProjectAccess(options?: Options) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  // `hasAccess` is the backend's effective authorization decision for a
  // project: it already accounts for open membership and organization-level
  // roles, not just team membership. Requiring `isMember` on top of it hides
  // projects the user is genuinely allowed to open.
  const hasProjectAccess = options?.superuserNeedsToBeProjectMember
    ? !!projects?.some(p => p.isMember && p.hasAccess)
    : !!projects?.some(p => p.hasAccess);

  return {hasProjectAccess, projectsLoaded};
}
