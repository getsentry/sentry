import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {update} from 'sentry/actionCreators/projects';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApi} from 'sentry/utils/useApi';

interface ToggleProjectBookmarkVariables {
  isBookmarked: boolean;
  project: Project;
}

interface UseToggleProjectBookmarkOptions {
  organization: Organization;
  onError?: (variables: ToggleProjectBookmarkVariables) => void;
  onMutate?: (variables: ToggleProjectBookmarkVariables) => void;
  /**
   * Called once the request finishes, whether it succeeded or failed. The
   * projects store holds the final bookmark state by then.
   */
  onSettled?: (variables: ToggleProjectBookmarkVariables) => void;
}

/**
 * Sets a project's bookmark and updates the projects store on success.
 * Shows an error toast when the request fails.
 */
export function useToggleProjectBookmark({
  organization,
  onError,
  onMutate,
  onSettled,
}: UseToggleProjectBookmarkOptions) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: ({
      project,
      isBookmarked,
    }: ToggleProjectBookmarkVariables): Promise<Project> =>
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
