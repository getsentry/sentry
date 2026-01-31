import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type UseTogglePluginMutationOptions = {
  projectSlug: string;
  analyticsView?: 'legacy_integrations' | 'plugin_details';
};

type TogglePluginParams = {
  pluginId: string;
  shouldEnable: boolean;
};

export function useTogglePluginMutation({
  projectSlug,
  analyticsView,
}: UseTogglePluginMutationOptions) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const pluginsQueryKey = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/plugins/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug},
    }
  );

  return useMutation({
    mutationFn: ({pluginId, shouldEnable}: TogglePluginParams) => {
      const method = shouldEnable ? 'POST' : 'DELETE';
      return fetchMutation({
        method,
        url: `/projects/${organization.slug}/${projectSlug}/plugins/${pluginId}/`,
      });
    },
    onMutate: ({pluginId, shouldEnable}) => {
      addLoadingMessage(shouldEnable ? t('Enabling...') : t('Disabling...'));

      // Optimistically update the plugins list cache
      setApiQueryData<Plugin[]>(queryClient, [pluginsQueryKey], plugins =>
        plugins?.map(plugin =>
          plugin.id === pluginId ? {...plugin, enabled: shouldEnable} : plugin
        )
      );

      // Optimistically update the plugin details cache
      const pluginDetailsQueryKey = getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/plugins/$pluginId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug,
            pluginId,
          },
        }
      );
      setApiQueryData<Plugin>(queryClient, [pluginDetailsQueryKey], plugin =>
        plugin ? {...plugin, enabled: shouldEnable} : plugin
      );

      // Track analytics
      if (analyticsView) {
        const eventKey = shouldEnable ? 'integrations.enabled' : 'integrations.disabled';
        trackAnalytics(eventKey, {
          integration: pluginId,
          integration_type: 'plugin',
          view: analyticsView,
          organization,
        });
      }
    },
    onSuccess: (_data, {shouldEnable}) => {
      addSuccessMessage(
        shouldEnable ? t('Plugin was enabled') : t('Plugin was disabled')
      );
    },
    onError: (_error, {pluginId, shouldEnable}) => {
      addErrorMessage(
        shouldEnable ? t('Unable to enable plugin') : t('Unable to disable plugin')
      );
      const pluginDetailsQueryKey = `/projects/${organization.slug}/${projectSlug}/plugins/${pluginId}/`;
      queryClient.invalidateQueries({queryKey: [pluginsQueryKey]});
      queryClient.invalidateQueries({queryKey: [pluginDetailsQueryKey]});
    },
    onSettled: (_data, _error, {pluginId}) => {
      const pluginDetailsQueryKey = `/projects/${organization.slug}/${projectSlug}/plugins/${pluginId}/`;
      queryClient.invalidateQueries({queryKey: [pluginsQueryKey]});
      queryClient.invalidateQueries({queryKey: [pluginDetailsQueryKey]});
    },
  });
}
