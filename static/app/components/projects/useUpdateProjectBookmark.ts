import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

interface UpdateProjectBookmarkVariables {
  isBookmarked: boolean;
  project: Project;
}

interface UseUpdateProjectBookmarkOptions {
  organization: Organization;
  onError?: (variables: UpdateProjectBookmarkVariables) => void;
  onMutate?: (variables: UpdateProjectBookmarkVariables) => void;
  /**
   * Called once the request finishes, whether it succeeded or failed. The
   * projects store holds the final bookmark state by then.
   */
  onSettled?: (variables: UpdateProjectBookmarkVariables) => void;
}

/**
 * Sets a project's bookmark and updates the projects store on success.
 * Shows an error toast when the request fails.
 *
 * Why not `useUpdateProject`:
 * - It binds the project when the hook is created. Here the project is a
 *   mutation variable, so a single hook can serve a whole list of projects
 *   (e.g. the org menu) instead of one hook per row.
 * - It writes the change to `ProjectsStore` before the request finishes and
 *   then invalidates the detailed-project query. Callers here already keep
 *   their own pending state (local state in `BookmarkStar`, pending bookmarks
 *   in the org menu), so the early store write would duplicate it, and the
 *   invalidation would refetch the detailed project after every star click
 *   for no benefit.
 */
export function useUpdateProjectBookmark({
  organization,
  onError,
  onMutate,
  onSettled,
}: UseUpdateProjectBookmarkOptions) {
  return useMutation({
    mutationFn: ({project, isBookmarked}: UpdateProjectBookmarkVariables) =>
      fetchMutation<Project>({
        method: 'PUT',
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        }),
        data: {isBookmarked},
      }),
    onMutate: variables => onMutate?.(variables),
    onSuccess: project => ProjectsStore.onUpdateSuccess(project),
    onError: (_error, variables) => {
      toast.error(t('Unable to toggle bookmark for %s', variables.project.slug));
      onError?.(variables);
    },
    onSettled: (_data, _error, variables) => onSettled?.(variables),
  });
}
