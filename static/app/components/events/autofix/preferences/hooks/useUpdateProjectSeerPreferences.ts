import {useCallback} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {bulkAutofixAutomationSettingsInfiniteOptions} from './useBulkAutofixAutomationSettings';

export function useFetchProjectSeerPreferences({project}: {project: Project}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    const data = await queryClient.fetchQuery({
      ...projectSeerPreferencesApiOptions(organization.slug, project.slug),
      staleTime: 0,
    });
    return data?.json?.preference;
  }, [queryClient, organization.slug, project.slug]);
}

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
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
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

      const bulkAutofixAutomationSettingsQueryOptions =
        bulkAutofixAutomationSettingsInfiniteOptions({
          organization,
        });
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsQueryOptions.queryKey,
      });
    },
  });
}
