import React from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import PluginList from 'app/components/pluginList';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import StackedBarChart from 'app/components/stackedBarChart';
import TextBlock from 'app/views/settings/components/text/textBlock';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';

class DataForwardingStats extends AsyncComponent {
  getEndpoints() {
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
    const stats = this.state.stats.map(p => ({x: p[0], y: [p[1]]}));

    return (
      <Panel>
        <SentryDocumentTitle title={t('Data Forwarding')} objSlug={projectId} />
        <PanelHeader>{t('Forwarded events in the last 30 days (by day)')}</PanelHeader>
        <PanelBody>
          {stats.length > 0 && stats[0][0] ? (
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
            <div className="blankslate p-y-2">
              <h5>{t('Nothing forwarded in the last 30 days.')}</h5>
              <p className="m-b-0">
                {t('Total events forwarded to third party integrations.')}
              </p>
            </div>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

class ProjectDataForwarding extends AsyncComponent {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;

    return [['plugins', `/projects/${orgId}/${projectId}/plugins/`]];
  }

  get forwardingPlugins() {
    return this.state.plugins.filter(
      p => p.type === 'data-forwarding' && p.hasConfiguration
    );
  }

  updatePlugin(plugin, enabled) {
    const plugins = this.state.plugins.map(p => ({
      ...p,
      enabled: p.id === plugin.id ? enabled : p.enabled,
    }));

    this.setState({plugins});
  }

  onEnablePlugin = plugin => this.updatePlugin(plugin, true);
  onDisablePlugin = plugin => this.updatePlugin(plugin, false);

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

              <Alert icon="icon-circle-info">
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

export default withProjects(withOrganization(ProjectDataForwarding));
