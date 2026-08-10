import {useQueryClient} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import type {GeneralSettings} from './projectPerformanceSettings';

export const getGeneralSettingsQueryOptions = (orgSlug: string, projectSlug: string) =>
  apiOptions.as<GeneralSettings>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: 0,
    }
  );

export function useGeneralSettingsMutationOptions() {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();

  return {
    mutationFn: (data: {enable_images: boolean}) =>
      fetchMutation({
        url: `/projects/${organization.slug}/${projectSlug}/performance/configure/`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data: unknown, variables: {enable_images: boolean}) => {
      queryClient.setQueryData(
        getGeneralSettingsQueryOptions(organization.slug, projectSlug).queryKey,
        previous =>
          previous
            ? {json: {...previous.json, ...variables}, headers: previous.headers}
            : previous
      );
    },
  };
}
