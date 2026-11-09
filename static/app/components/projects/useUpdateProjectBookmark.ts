import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {update} from 'sentry/actionCreators/projects';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApi} from 'sentry/utils/useApi';

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
 * Uses the legacy `update` action creator instead of `fetchMutation` on
 * purpose: `update` writes the response into `ProjectsStore`, which the
 * callers read their final bookmark state from. `persistInFlight` keeps the
 * request alive when the calling component unmounts, e.g. a closing menu.
 */
export function useUpdateProjectBookmark({
  organization,
  onError,
  onMutate,
  onSettled,
}: UseUpdateProjectBookmarkOptions) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: ({
      project,
      isBookmarked,
    }: UpdateProjectBookmarkVariables): Promise<Project> =>
      update(api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {isBookmarked},
      }),
    onMutate: variables => onMutate?.(variables),
    onError: (_error, variables) => {
      toast.error(t('Unable to toggle bookmark for %s', variables.project.slug));
      onError?.(variables);
    },
    onSettled: (_data, _error, variables) => onSettled?.(variables),
  });
}
