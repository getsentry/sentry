import {useMutation, useQueryClient} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  SeerWorkflowConfigCreateRequest,
  SeerWorkflowConfigResponse,
  SeerWorkflowConfigUpdateRequest,
} from 'sentry/views/seerWorkflows/types';

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
 * Creates an automation's config and refetches the organization's configs.
 */
export function useConfigCreate() {
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
export function useConfigUpdate({configId}: {configId: string}) {
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
export function useConfigDelete({configId}: {configId: string}) {
  const queryClient = useQueryClient();
  const {configsUrl, configUrl} = useConfigUrls(configId);

  return useMutation({
    mutationFn: () => fetchMutation({url: configUrl, method: 'DELETE'}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: [configsUrl]}),
  });
}
