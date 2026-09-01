import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

type Options = {
  /**
   * When true, every user must also be a project member to count as having
   * access. Use this for views that cannot render anything useful without team
   * membership, regardless of who is looking at them.
   */
  requireProjectMembership?: boolean;
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

  const needsMembership =
    options?.requireProjectMembership ||
    (user.isSuperuser && options?.superuserNeedsToBeProjectMember);

  // `hasAccess` is the backend's effective authorization decision for a
  // project: it already accounts for open membership and organization-level
  // roles, not just team membership. Requiring `isMember` on top of it hides
  // projects the user is genuinely allowed to open.
  const hasProjectAccess = !!projects?.some(
    project => project.hasAccess && (!needsMembership || project.isMember)
  );

  return {hasProjectAccess, projectsLoaded};
}
