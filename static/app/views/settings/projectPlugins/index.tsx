import {Fragment, useEffect} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import ProjectPlugins from './projectPlugins';
import {useTogglePluginMutation} from './useTogglePluginMutation';

export default function ProjectPluginsContainer() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const pluginsQueryKey = `/projects/${organization.slug}/${project.slug}/plugins/`;

  const {
    data: plugins = [],
    isPending: loading,
    isError,
    error,
  } = useApiQuery<Plugin[]>([pluginsQueryKey], {
    staleTime: 0,
  });

  useEffect(() => {
    // Track analytics
    if (plugins) {
      const installCount = plugins.filter(
        plugin => plugin.hasConfiguration && plugin.enabled
      ).length;
      trackAnalytics(
        'integrations.index_viewed',
        {
          integrations_installed: installCount,
          view: 'legacy_integrations',
          organization,
        },
        {startSession: true}
      );
    }
  }, [plugins, organization]);

  const togglePluginMutation = useTogglePluginMutation({
    projectSlug: project.slug,
  });

  const title = t('Legacy Integrations');

  return (
    <Fragment>
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <SettingsPageHeader title={title} />
      <ProjectPermissionAlert project={project} />

      <ProjectPlugins
        organization={organization}
        project={project}
        onChange={(pluginId, shouldEnable) =>
          togglePluginMutation.mutate({pluginId, shouldEnable})
        }
        loading={loading}
        error={isError ? error : undefined}
        plugins={plugins}
      />
    </Fragment>
  );
}
