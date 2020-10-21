import { Fragment } from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {IconInfo} from 'app/icons';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import PluginList from 'app/components/pluginList';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import StackedBarChart from 'app/components/stackedBarChart';
import TextBlock from 'app/views/settings/components/text/textBlock';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {Organization, Plugin, Project} from 'app/types';

type RouteParams = {projectId: string; orgId: string};

type StatProps = {
  params: RouteParams;
};

type StatState = AsyncComponent['state'] & {
  stats: Array<{x: number; y: [number]}>;
};

class DataForwardingStats extends AsyncComponent<StatProps, StatState> {
  getEndpoints(): [[string, string, object]] {
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
    //y is an array of size one which denotes how many events were forwarded in that period
    const stats = this.state.stats.map(p => ({x: p[0], y: [p[1]]}));
    const forwardedAny = stats.some(({y}) => y[0]);

    return (
      <Panel>
        <SentryDocumentTitle title={t('Data Forwarding')} objSlug={projectId} />
        <PanelHeader>{t('Forwarded events in the last 30 days (by day)')}</PanelHeader>
        <PanelBody>
          {forwardedAny ? (
            <StackedBarChart
              style={{
                border: 'none',
              }}
              points={stats}
              height={150}
              label="events"
              barClasses={['accepted']}
              className="standard-barchart"
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
  getEndpoints(): [[string, string]] {
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
            </Fragment>
          )}
        </Feature>
      </div>
    );
  }
}

export default withProject(withOrganization(ProjectDataForwarding));
