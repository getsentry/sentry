import {Fragment, useState} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Alert} from 'sentry/components/alert';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PluginList from 'sentry/components/pluginList';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {TimeseriesValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Plugin} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

function DataForwardingStats() {
  const {orgId, projectId} = useParams<{orgId: string; projectId: string}>();

  const until = Math.floor(new Date().getTime() / 1000);
  const since = until - 3600 * 24 * 30;
  const options = {
    query: {
      since,
      until,
      resolution: '1d',
      stat: 'forwarded',
    },
  };

  const {
    data: stats,
    isPending,
    isError,
    refetch,
  } = useApiQuery<TimeseriesValue[]>(
    [`/projects/${orgId}/${projectId}/stats/`, options],
    {staleTime: 0}
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const series: Series = {
    seriesName: t('Forwarded'),
    data: stats.map(([timestamp, value]) => ({name: timestamp * 1000, value})),
  };
  const forwardedAny = series.data.some(({value}) => value > 0);

  return (
    <Panel>
      <SentryDocumentTitle title={t('Data Forwarding')} projectSlug={projectId} />
      <PanelHeader>{t('Forwarded events in the last 30 days (by day)')}</PanelHeader>
      <PanelBody withPadding>
        {forwardedAny ? (
          <MiniBarChart
            isGroupedByDate
            showTimeInTooltip
            labelYAxisExtents
            series={[series]}
            height={150}
          />
        ) : (
          <EmptyMessage
            title={t('Nothing forwarded in the last 30 days.')}
            description={t('Total events forwarded to third party integrations.')}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

type Props = {
  project: Project;
};

function ProjectDataForwarding({project}: Props) {
  const organization = useOrganization();
  const {projectId} = useParams<{projectId: string}>();
  const [pluginState, setPluginState] = useState<Plugin[]>([]);

  const {
    data: fetchedPlugins,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Plugin[]>([`/projects/${organization.slug}/${projectId}/plugins/`], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const plugins = pluginState.length ? pluginState : fetchedPlugins;

  const forwardingPlugins = () => {
    return plugins.filter(p => p.type === 'data-forwarding' && p.hasConfiguration);
  };

  const updatePlugin = (plugin: Plugin, enabled: boolean) => {
    const newPlugins = plugins.map(p => ({
      ...p,
      enabled: p.id === plugin.id ? enabled : p.enabled,
    }));

    setPluginState(newPlugins);
  };

  const onEnablePlugin = (plugin: Plugin) => updatePlugin(plugin, true);
  const onDisablePlugin = (plugin: Plugin) => updatePlugin(plugin, false);

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const pluginsPanel =
    plugins.length > 0 ? (
      <PluginList
        organization={organization}
        project={project}
        pluginList={forwardingPlugins()}
        onEnablePlugin={onEnablePlugin}
        onDisablePlugin={onDisablePlugin}
      />
    ) : (
      <Panel>
        <EmptyMessage
          title={t('There are no integrations available for data forwarding')}
        />
      </Panel>
    );

  return (
    <div data-test-id="data-forwarding-settings">
      <Feature
        features="projects:data-forwarding"
        hookName="feature-disabled:data-forwarding"
      >
        {({hasFeature, features}) => (
          <Fragment>
            <SettingsPageHeader title={t('Data Forwarding')} />
            <TextBlock>
              {tct(
                `Data Forwarding allows processed events to be sent to your
                favorite business intelligence tools. The exact payload and
                types of data depend on the integration you're using. Learn
                more about this functionality in our [link:documentation].`,
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/data-management-settings/data-forwarding/" />
                  ),
                }
              )}
            </TextBlock>
            <ProjectPermissionAlert project={project} />

            <Alert showIcon type="info">
              {tct(
                `Sentry forwards [em:all applicable error events] to the provider, in
                some cases this may be a significant volume of data.`,
                {
                  em: <strong />,
                }
              )}
            </Alert>

            {!hasFeature && (
              <FeatureDisabled
                alert
                featureName={t('Data Forwarding')}
                features={features}
              />
            )}

            <DataForwardingStats />
            {hasAccess && hasFeature && pluginsPanel}
          </Fragment>
        )}
      </Feature>
    </div>
  );
}

export default ProjectDataForwarding;
