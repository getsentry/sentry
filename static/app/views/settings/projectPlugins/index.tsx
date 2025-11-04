import {Fragment, useEffect} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import ProjectPlugins from './projectPlugins';
import {useTogglePluginMutation} from './useTogglePluginMutation';

type Props = RouteComponentProps<{projectId: string}> & {
  organization: Organization;
  project: Project;
};

export default function ProjectPluginsContainer({
  organization,
  project,
  ...props
}: Props) {
  const {projectId} = useParams<{projectId: string}>();
  const pluginsQueryKey = `/projects/${organization.slug}/${projectId}/plugins/`;

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
    projectSlug: projectId,
  });

  const title = t('Legacy Integrations');

  return (
    <Fragment>
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <SettingsPageHeader title={title} />
      <ProjectPermissionAlert project={project} />

      <ProjectPlugins
        {...props}
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
