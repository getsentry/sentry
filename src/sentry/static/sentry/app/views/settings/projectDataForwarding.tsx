import React from 'react';
import {RouteComponentProps} from 'react-router';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import MiniBarChart from 'app/components/charts/miniBarChart';
import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PluginList from 'app/components/pluginList';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization, Plugin, Project, TimeseriesValue} from 'app/types';
import {Series} from 'app/types/echarts';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/project/permissionAlert';

type RouteParams = {projectId: string; orgId: string};

type StatProps = {
  params: RouteParams;
};

type StatState = AsyncComponent['state'] & {
  stats: TimeseriesValue[];
};

class DataForwardingStats extends AsyncComponent<StatProps, StatState> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
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

    return [['stats', `/projects/${orgId}/${projectId}/stats/`, options]];
  }

  renderBody() {
    const {projectId} = this.props.params;
    const {stats} = this.state;
    const series: Series = {
      seriesName: t('Forwarded'),
      data: stats.map(([timestamp, value]) => ({name: timestamp * 1000, value})),
    };
    const forwardedAny = series.data.some(({value}) => value > 0);

    return (
      <Panel>
        <SentryDocumentTitle title={t('Data Forwarding')} objSlug={projectId} />
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
}

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncComponent['state'] & {
  plugins: Plugin[];
};

class ProjectDataForwarding extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectId} = this.props.params;

    return [['plugins', `/projects/${orgId}/${projectId}/plugins/`]];
  }

  get forwardingPlugins() {
    return this.state.plugins.filter(
      p => p.type === 'data-forwarding' && p.hasConfiguration
    );
  }

  updatePlugin(plugin: Plugin, enabled: boolean) {
    const plugins = this.state.plugins.map(p => ({
      ...p,
      enabled: p.id === plugin.id ? enabled : p.enabled,
    }));

    this.setState({plugins});
  }

  onEnablePlugin = (plugin: Plugin) => this.updatePlugin(plugin, true);
  onDisablePlugin = (plugin: Plugin) => this.updatePlugin(plugin, false);

  renderBody() {
    const {params, organization, project} = this.props;
    const plugins = this.forwardingPlugins;
    const hasAccess = organization.access.includes('project:write');

    const pluginsPanel =
      plugins.length > 0 ? (
        <PluginList
          organization={organization}
          project={project}
          pluginList={plugins}
          onEnablePlugin={this.onEnablePlugin}
          onDisablePlugin={this.onDisablePlugin}
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
          features={['projects:data-forwarding']}
          hookName="feature-disabled:data-forwarding"
        >
          {({hasFeature, features}) => (
            <React.Fragment>
              <SettingsPageHeader title={t('Data Forwarding')} />
              <TextBlock>
                {tct(
                  `Data Forwarding allows processed events to be sent to your
                favorite business intelligence tools. The exact payload and
                types of data depend on the integration you're using. Learn
                more about this functionality in our [link:documentation].`,
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/learn/data-forwarding/" />
                    ),
                  }
                )}
              </TextBlock>
              <PermissionAlert />

              <Alert icon={<IconInfo size="md" />}>
                {tct(
                  `Sentry forwards [em:all applicable events] to the provider, in
                some cases this may be a significant volume of data.`,
                  {
                    em: <strong />,
                  }
                )}
              </Alert>

              {!hasFeature && (
                <FeatureDisabled
                  alert
                  featureName="Data Forwarding"
                  features={features}
                />
              )}

              <DataForwardingStats params={params} />
              {hasAccess && hasFeature && pluginsPanel}
            </React.Fragment>
          )}
        </Feature>
      </div>
    );
  }
}

export default withProject(withOrganization(ProjectDataForwarding));
