import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {disablePlugin, enablePlugin} from 'sentry/actionCreators/plugins';
import {Button} from 'sentry/components/core/button';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PluginConfig from 'sentry/components/pluginConfig';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Plugin} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getDynamicText from 'sentry/utils/getDynamicText';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import withPlugins from 'sentry/utils/withPlugins';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = {
  organization: Organization;
  plugins: {
    plugins: Plugin[];
  };
  project: Project;
};

/**
 * There are currently two sources of truths for plugin details:
 *
 * 1) PluginsStore has a list of plugins, and this is where ENABLED state lives
 * 2) We fetch "plugin details" via API and save it to local state as `pluginDetails`.
 *    This is because "details" call contains form `config` and the "list" endpoint does not.
 *    The more correct way would be to pass `config` to PluginConfig and use plugin from
 *    PluginsStore
 */
function ProjectPluginDetails({organization, plugins, project}: Props) {
  const api = useApi({persistInFlight: true});
  const {pluginId, projectId} = useParams<{pluginId: string; projectId: string}>();
  const endpoint = `/projects/${organization.slug}/${projectId}/plugins/${pluginId}/`;

  const {
    data: pluginDetails,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Plugin>([endpoint], {
    staleTime: 0,
  });

  const trimSchema = (value: string) => value.split('//')[1];

  const resetMutation = useMutation({
    mutationFn: () =>
      api.requestPromise(endpoint, {
        method: 'POST',
        data: {reset: true},
      }),
    onMutate: () => {
      addLoadingMessage(t('Saving changes\u2026'));
      trackIntegrationAnalytics('integrations.uninstall_clicked', {
        integration: pluginId,
        integration_type: 'plugin',
        view: 'plugin_details',
        organization,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Plugin was reset'));
      trackIntegrationAnalytics('integrations.uninstall_completed', {
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

  const analyticsChangeEnableStatus = useCallback(
    (enabled: boolean) => {
      const eventKey = enabled ? 'integrations.enabled' : 'integrations.disabled';
      trackIntegrationAnalytics(eventKey, {
        integration: pluginId,
        integration_type: 'plugin',
        view: 'plugin_details',
        organization,
      });
    },
    [pluginId, organization]
  );

  // Enabled state is handled via PluginsStore and not via plugins detail
  const getEnabled = () => {
    const plugin = plugins?.plugins?.find(({slug}) => slug === pluginId);
    return plugin ? plugin.enabled : pluginDetails?.enabled;
  };

  const handleEnable = useCallback(() => {
    enablePlugin({pluginId, projectId, orgId: organization.slug});
    analyticsChangeEnableStatus(true);
  }, [organization.slug, analyticsChangeEnableStatus, pluginId, projectId]);

  const handleDisable = useCallback(() => {
    disablePlugin({pluginId, projectId, orgId: organization.slug});
    analyticsChangeEnableStatus(false);
  }, [organization.slug, analyticsChangeEnableStatus, pluginId, projectId]);

  useEffect(() => {
    trackIntegrationAnalytics('integrations.details_viewed', {
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
      <StyledButton size="sm" onClick={handleEnable}>
        {t('Enable Plugin')}
      </StyledButton>
    );

    const disable = (
      <StyledButton size="sm" priority="danger" onClick={handleDisable}>
        {t('Disable Plugin')}
      </StyledButton>
    );

    const toggleEnable = enabled ? disable : enable;

    return (
      <div className="pull-right">
        {pluginDetails.canDisable && toggleEnable}
        <Button size="sm" redesign onClick={() => resetMutation.mutate()}>
          {t('Reset Configuration')}
        </Button>
      </div>
    );
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
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
            onDisablePlugin={handleDisable}
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
              <dd>
                {getDynamicText({
                  value: pluginDetails.version,
                  fixed: '1.0.0',
                })}
              </dd>
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

export {ProjectPluginDetails};

export default withPlugins(ProjectPluginDetails);

const StyledButton = styled(Button)`
  margin-right: ${space(0.75)};
`;
