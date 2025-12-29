import {makeProjectSeerPreferencesQueryKey} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useUpdateProjectSeerPreferences(project: Project) {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<ProjectSeerPreferences>) => {
      return api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        {
          method: 'POST',
          data,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: makeProjectSeerPreferencesQueryKey(organization.slug, project.slug),
      });
    },
  });
}
