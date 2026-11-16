import {
  keepPreviousData,
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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
 * Fetches the organization's automation configs. Pass `ids` to only fetch those configs;
 * an empty list fetches nothing. Pass `keepPrevious` to keep returning the last configs
 * while a different set of `ids` loads.
 */
export function useFetchConfigs({
  ids,
  keepPrevious,
}: {ids?: string[]; keepPrevious?: boolean} = {}) {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  return useQuery({
    ...apiOptions.as<SeerWorkflowConfigsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path:
          automationsEnabled && ids?.length !== 0
            ? {organizationIdOrSlug: organization.slug}
            : skipToken,
        query: {id: ids},
        staleTime: 0,
      }
    ),
    select: data => selectJson(data).configs,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
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

function getUpdateConfigMutationKey(configId: string) {
  return ['seer-workflow-config-update', configId];
}

/**
 * Whether any update to the automation's config is in flight.
 */
export function useIsUpdatingConfig({configId}: {configId: string}) {
  return useIsMutating({mutationKey: getUpdateConfigMutationKey(configId)}) > 0;
}

/**
 * Updates an automation's config and refetches the organization's configs.
 */
export function useUpdateConfig({configId}: {configId: string}) {
  const queryClient = useQueryClient();
  const {configsUrl, configUrl} = useConfigUrls(configId);

  return useMutation({
    mutationKey: getUpdateConfigMutationKey(configId),
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
