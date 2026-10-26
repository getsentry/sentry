import {useMutation, useQueryClient} from '@tanstack/react-query';

import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useUpdateProjectSeerPreferences(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const prefsOptions = projectSeerPreferencesApiOptions(organization.slug, project.slug);
  const queryKey = prefsOptions.queryKey;

  return useMutation({
    onMutate: preference => {
      const previousPrefs = queryClient.getQueryData(queryKey);
      if (!previousPrefs) {
        return {error: new Error('Previous preferences not found')};
      }
      queryClient.setQueryData(queryKey, {
        ...previousPrefs,
        json: {
          preference: {
            ...(previousPrefs.json.preference ?? null),
            ...preference,
          },
          code_mapping_repos: previousPrefs.json.code_mapping_repos,
        },
      });

      return {previousPrefs};
    },
    mutationFn: (preference: ProjectSeerPreferences) => {
      return fetchMutation({
        method: 'POST',
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/preferences/',
          {path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}}
        ),
        data: {...preference},
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData(queryKey, context.previousPrefs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });
}
