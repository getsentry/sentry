import type {ProjectPreferences} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useSaveProjectPreferences(project: Project) {
  const organization = useOrganization();
  const api = useApi();

  return useMutation({
    mutationFn: (data: ProjectPreferences) => {
      return api
        .requestPromise(
          `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
          {
            method: 'POST',
            data,
          }
        )
        .then(resp => {
          if (!resp.ok) {
            throw new Error('Failed to save preferences');
          }
          return resp.json();
        });
    },
  });
}
