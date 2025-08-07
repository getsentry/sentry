import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useUpdateProjectSeerPreferences(project: Project) {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: (data: ProjectSeerPreferences) => {
      const payload: ProjectSeerPreferences = {
        repositories: data.repositories,
        automated_run_stopping_point: data.automated_run_stopping_point ?? 'solution',
      };
      return api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        {
          method: 'POST',
          data: payload,
        }
      );
    },
  });
}
