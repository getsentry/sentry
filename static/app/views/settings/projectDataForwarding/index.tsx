import {Fragment, useState} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
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
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {DATA_FORWARDING_DOCS_URL} from 'sentry/views/settings/organizationDataForwarding/util/types';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

type DataForwardingStatsProps = {
  organization: Organization;
  project: Project;
};

function DataForwardingStats({organization, project}: DataForwardingStatsProps) {
  const [until] = useState(() => Math.floor(Date.now() / 1000));
  const since = until - 3600 * 24 * 30;
  const options = {
    query: {
      since,
      until,
      resolution: '1d',
      stat: 'forwarded',
    },
  };

  const {data: stats = [], isPending} = useApiQuery<TimeseriesValue[]>(
    [`/projects/${organization.slug}/${project.slug}/stats/`, options],
    {staleTime: 0, retry: false}
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  const series: Series = {
    seriesName: t('Forwarded'),
    data: stats.map(([timestamp, value]) => ({name: timestamp * 1000, value})),
  };
  const forwardedAny = series.data.some(({value}) => value > 0);

  return (
    <Panel>
      <SentryDocumentTitle title={t('Data Forwarding')} projectSlug={project.slug} />
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
          <EmptyMessage title={t('Nothing forwarded in the last 30 days.')}>
            {t('Total events forwarded to third party integrations.')}
          </EmptyMessage>
        )}
      </PanelBody>
    </Panel>
  );
}

export default function ProjectDataForwarding() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const {
    data: plugins = [],
    isPending,
    isError,
    refetch,
  } = useApiQuery<Plugin[]>([`/projects/${organization.slug}/${project.slug}/plugins/`], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const forwardingPlugins = () => {
    return plugins.filter(p => p.type === 'data-forwarding' && p.hasConfiguration);
  };

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const pluginsPanel =
    plugins.length > 0 ? (
      <PluginList project={project} pluginList={forwardingPlugins()} />
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
            <TextBlock>
              {tct(
                `Sentry forwards [em:all applicable error events] to the provider, in
                some cases this may be a significant volume of data.`,
                {
                  em: <strong />,
                }
              )}
            </TextBlock>
            <Alert.Container>
              <Alert variant="warning">
                {tct(
                  'This project-level feature is deprecated, and will be replaced by organization-level [docs:Data Forwarding]. Existing configurations will be auto-migrated when the feature is available to your organization.',
                  {
                    docs: <ExternalLink href={DATA_FORWARDING_DOCS_URL} />,
                  }
                )}
              </Alert>
            </Alert.Container>
            <ProjectPermissionAlert project={project} />

            {!hasFeature && (
              <FeatureDisabled
                alert
                featureName={t('Data Forwarding')}
                features={features}
              />
            )}

            <DataForwardingStats organization={organization} project={project} />
            {hasAccess && hasFeature && pluginsPanel}
          </Fragment>
        )}
      </Feature>
    </div>
  );
}
