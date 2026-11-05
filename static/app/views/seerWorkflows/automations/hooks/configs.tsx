import {skipToken, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {apiOptions, selectJson} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  SeerWorkflowConfigCreateRequest,
  SeerWorkflowConfigResponse,
  SeerWorkflowConfigsResponse,
  SeerWorkflowConfigUpdateRequest,
} from 'sentry/views/seerWorkflows/types';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

function useConfigUrls(configId = '') {
  const organization = useOrganization();
  return {
    configsUrl: getApiUrl(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    configUrl: getApiUrl(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/$configId/',
      {path: {organizationIdOrSlug: organization.slug, configId}}
    ),
  };
}

/**
 * Fetches the organization's automation configs. Pass `ids` to only fetch those configs.
 */
export function useFetchConfigs({ids}: {ids?: string[]} = {}) {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  return useQuery({
    ...apiOptions.as<SeerWorkflowConfigsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {id: ids},
        staleTime: 0,
      }
    ),
    select: data => selectJson(data).configs,
  });
}

/**
 * Creates an automation's config and refetches the organization's configs.
 */
export function useCreateConfig() {
  const queryClient = useQueryClient();
  const {configsUrl} = useConfigUrls();

  return useMutation({
    mutationFn: (data: SeerWorkflowConfigCreateRequest) =>
      fetchMutation<SeerWorkflowConfigResponse>({url: configsUrl, method: 'POST', data}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: [configsUrl]}),
  });
}

/**
 * Updates an automation's config and refetches the organization's configs.
 */
export function useUpdateConfig({configId}: {configId: string}) {
  const queryClient = useQueryClient();
  const {configsUrl, configUrl} = useConfigUrls(configId);

  return useMutation({
    mutationFn: (data: SeerWorkflowConfigUpdateRequest) =>
      fetchMutation<SeerWorkflowConfigResponse>({url: configUrl, method: 'PUT', data}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: [configsUrl]}),
  });
}

/**
 * Deletes an automation's config and refetches the organization's configs.
 */
export function useDeleteConfig({configId}: {configId: string}) {
  const queryClient = useQueryClient();
  const {configsUrl, configUrl} = useConfigUrls(configId);

  return useMutation({
    mutationFn: () => fetchMutation({url: configUrl, method: 'DELETE'}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: [configsUrl]}),
  });
}
