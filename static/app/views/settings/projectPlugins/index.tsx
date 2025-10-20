import {Fragment, useCallback, useEffect} from 'react';

import {disablePlugin, enablePlugin} from 'sentry/actionCreators/plugins';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import ProjectPlugins from './projectPlugins';

export default function ProjectPluginsContainer() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const {
    data: plugins = [],
    isPending: loading,
    isError,
    error,
  } = useApiQuery<Plugin[]>([`/projects/${organization.slug}/${project.slug}/plugins/`], {
    staleTime: 0,
  });

  useEffect(() => {
    if (plugins.length > 0) {
      const installCount = plugins.filter(
        plugin => plugin.hasConfiguration && plugin.enabled
      ).length;
      trackIntegrationAnalytics(
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

  const handleChange = useCallback(
    (pluginId: string, shouldEnable: boolean) => {
      const actionCreator = shouldEnable ? enablePlugin : disablePlugin;
      actionCreator({projectId: project.slug, orgId: organization.slug, pluginId});
    },
    [organization.slug, project.slug]
  );

  const title = t('Legacy Integrations');

  return (
    <Fragment>
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <SettingsPageHeader title={title} />
      <ProjectPermissionAlert project={project} />

      <ProjectPlugins
        onChange={handleChange}
        loading={loading}
        error={isError ? error : undefined}
        plugins={plugins}
        organization={organization}
        project={project}
      />
    </Fragment>
  );
}
