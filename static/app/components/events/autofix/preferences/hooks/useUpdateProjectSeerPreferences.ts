import {
  makeProjectSeerPreferencesQueryKey,
  type SeerPreferencesResponse,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {
  fetchMutation,
  getApiQueryData,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Context =
  | {
      previousPrefs: SeerPreferencesResponse;
      error?: never;
    }
  | {
      error: Error;
      previousPrefs?: never;
    };

export function useUpdateProjectSeerPreferences(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const queryKey = makeProjectSeerPreferencesQueryKey(organization.slug, project.slug);

  return useMutation<unknown, Error, ProjectSeerPreferences, Context>({
    onMutate: preference => {
      const previousPrefs = getApiQueryData<SeerPreferencesResponse>(
        queryClient,
        queryKey
      );
      if (!previousPrefs) {
        return {error: new Error('Previous preferences not found')};
      }
      const updatedPreferences: SeerPreferencesResponse = {
        preference: {
          ...(previousPrefs.preference ?? null),
          ...preference,
        },
        code_mapping_repos: previousPrefs.code_mapping_repos,
      };

      setApiQueryData<SeerPreferencesResponse>(queryClient, queryKey, updatedPreferences);

      return {previousPrefs};
    },
    mutationFn: preference => {
      return fetchMutation<unknown>({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        data: {...preference},
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousPrefs) {
        setApiQueryData<SeerPreferencesResponse>(
          queryClient,
          queryKey,
          context.previousPrefs
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });
}
