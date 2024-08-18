import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {
  HighlightContext,
  HighlightTags,
} from 'sentry/components/events/highlights/util';
import {tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {makeDetailedProjectQueryKey} from 'sentry/utils/useDetailedProject';

interface MutateProjectPayload {
  // We can mutate more with this API call, but we'll keep this typed to the few places this is used
  highlightContext?: HighlightContext;
  highlightTags?: HighlightTags;
}

interface UseMutateProjectProps {
  organization: Organization;
  project: Project;
  onError?: (error: RequestError) => void;
  onSuccess?: (project: Project) => void;
}

export default function useMutateProject({
  organization,
  project,
  onSuccess,
  onError,
}: UseMutateProjectProps) {
  const api = useApi({
    persistInFlight: false,
  });
  const queryClient = useQueryClient();
  return useMutation<Project, RequestError, MutateProjectPayload>({
    mutationFn: data =>
      api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data,
      }),
    onSuccess: (updatedProject: Project) => {
      addSuccessMessage(
        tct(`Successfully updated '[projectName]' project`, {
          projectName: project.name,
        })
      );
      setApiQueryData<Project>(
        queryClient,
        makeDetailedProjectQueryKey({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        }),
        existingData => (updatedProject ? updatedProject : existingData)
      );
      return onSuccess?.(updatedProject);
    },
    onError: error => {
      addErrorMessage(
        tct(`Failed to update '[projectName]' project`, {
          projectName: project.name,
        })
      );
      return onError?.(error);
    },
  });
}
