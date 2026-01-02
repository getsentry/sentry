import {useEffect} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PluginConfig from 'sentry/components/pluginConfig';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Plugin} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {useTogglePluginMutation} from './useTogglePluginMutation';

export default function ProjectPluginDetails() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {pluginId} = useParams<{pluginId: string; projectId: string}>();
  const pluginsQueryKey = `/projects/${organization.slug}/${project.slug}/plugins/`;
  const pluginDetailsQueryKey = `/projects/${organization.slug}/${project.slug}/plugins/${pluginId}/`;

  const {
    data: plugins,
    isPending: isPluginsPending,
    isError: isPluginsError,
    refetch: refetchPlugins,
  } = useApiQuery<Plugin[]>([pluginsQueryKey], {
    staleTime: 0,
  });

  const {
    data: pluginDetails,
    isPending: isPluginDetailsPending,
    isError: isPluginDetailsError,
    refetch: refetchPluginDetails,
  } = useApiQuery<Plugin>([pluginDetailsQueryKey], {
    staleTime: 0,
  });

  const isPending = isPluginsPending || isPluginDetailsPending;
  const isError = isPluginsError || isPluginDetailsError;

  const trimSchema = (value: string) => value.split('//')[1];

  const resetMutation = useMutation({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: pluginDetailsQueryKey,
        data: {reset: true},
      }),
    onMutate: () => {
      addLoadingMessage(t('Saving changes\u2026'));
      trackAnalytics('integrations.uninstall_clicked', {
        integration: pluginId,
        integration_type: 'plugin',
        view: 'plugin_details',
        organization,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Plugin was reset'));
      trackAnalytics('integrations.uninstall_completed', {
        integration: pluginId,
        integration_type: 'plugin',
        view: 'plugin_details',
        organization,
      });
    },
    onError: () => {
      addErrorMessage(t('An error occurred'));
    },
  });

  const togglePluginMutation = useTogglePluginMutation({
    projectSlug: project.slug,
    analyticsView: 'plugin_details',
  });

  const getEnabled = () => {
    const plugin = plugins?.find(({slug}) => slug === pluginId);
    return plugin ? plugin.enabled : pluginDetails?.enabled;
  };

  useEffect(() => {
    trackAnalytics('integrations.details_viewed', {
      integration: pluginId,
      integration_type: 'plugin',
      view: 'plugin_details',
      organization,
    });
  }, [pluginId, organization]);

  const renderActions = () => {
    if (!pluginDetails) {
      return null;
    }
    const enabled = getEnabled();

    const enable = (
      <StyledButton
        size="sm"
        onClick={() => togglePluginMutation.mutate({pluginId, shouldEnable: true})}
      >
        {t('Enable Plugin')}
      </StyledButton>
    );

    const disable = (
      <StyledButton
        size="sm"
        priority="danger"
        onClick={() => togglePluginMutation.mutate({pluginId, shouldEnable: false})}
      >
        {t('Disable Plugin')}
      </StyledButton>
    );

    const toggleEnable = enabled ? disable : enable;

    return (
      <div className="pull-right">
        {pluginDetails.canDisable && toggleEnable}
        <Button size="sm" onClick={() => resetMutation.mutate()}>
          {t('Reset Configuration')}
        </Button>
      </div>
    );
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchPlugins();
          refetchPluginDetails();
        }}
      />
    );
  }

  if (!pluginDetails) {
    return null;
  }

  return (
    <div>
      <SentryDocumentTitle title={pluginDetails.name} projectSlug={project.slug} />
      <SettingsPageHeader title={pluginDetails.name} action={renderActions()} />
      <div className="row">
        <div className="col-md-7">
          <PluginConfig
            project={project}
            plugin={pluginDetails}
            enabled={getEnabled()}
            onDisablePlugin={() =>
              togglePluginMutation.mutate({pluginId, shouldEnable: false})
            }
          />
        </div>
        <div className="col-md-4 col-md-offset-1">
          <div className="pluginDetails-meta">
            <h4>{t('Plugin Information')}</h4>

            <dl className="flat">
              <dt>{t('Name')}</dt>
              <dd>{pluginDetails.name}</dd>
              <dt>{t('Author')}</dt>
              <dd>{pluginDetails.author?.name}</dd>
              {pluginDetails.author?.url && (
                <div>
                  <dt>{t('URL')}</dt>
                  <dd>
                    <ExternalLink href={pluginDetails.author.url}>
                      {trimSchema(pluginDetails.author.url)}
                    </ExternalLink>
                  </dd>
                </div>
              )}
              <dt>{t('Version')}</dt>
              <dd>{pluginDetails.version}</dd>
            </dl>

            {pluginDetails.description && (
              <div>
                <h4>{t('Description')}</h4>
                <p className="description">{pluginDetails.description}</p>
              </div>
            )}

            {pluginDetails.resourceLinks && (
              <div>
                <h4>{t('Resources')}</h4>
                <dl className="flat">
                  {pluginDetails.resourceLinks.map(({title, url}) => (
                    <dd key={url}>
                      <ExternalLink href={url}>{title}</ExternalLink>
                    </dd>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const StyledButton = styled(Button)`
  margin-right: ${space(0.75)};
`;
