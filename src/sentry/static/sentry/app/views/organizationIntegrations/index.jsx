import {Box} from 'grid-emotion';
import {compact, groupBy, keyBy} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {analytics} from 'app/utils/analytics';
import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import LoadingIndicator from 'app/components/loadingIndicator';
import MigrationWarnings from 'app/views/organizationIntegrations/migrationWarnings';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import ProviderRow from 'app/views/organizationIntegrations/providerRow';
import {removeSentryApp} from 'app/actionCreators/sentryApps';
import SentryAppInstallations from 'app/views/organizationIntegrations/sentryAppInstallations';
import SentryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';

class OrganizationIntegrations extends AsyncComponent {
  // Some integrations require visiting a different website to add them. When
  // we come back to the tab we want to show our integrations as soon as we can.
  shouldReload = true;
  reloadOnVisible = true;
  shouldReloadOnVisible = true;

  static propTypes = {
    organization: SentryTypes.Organization,
  };

  componentDidMount() {
    analytics('integrations.index_viewed', {
      org_id: parseInt(this.props.organization.id, 10),
    });
  }

  getEndpoints() {
    const {orgId} = this.props.params;
    const query = {plugins: ['vsts', 'github', 'bitbucket']};
    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integrations', `/organizations/${orgId}/integrations/`],
      ['plugins', `/organizations/${orgId}/plugins/`, {query}],
      ['orgOwnedApps', `/organizations/${orgId}/sentry-apps/`],
      ['publishedApps', '/sentry-apps/', {status: 'published'}],
      ['appInstalls', `/organizations/${orgId}/sentry-app-installations/`],
    ];
  }

  // State

  get enabledPlugins() {
    // List of slugs for each Plugin the Org/Project has currently enabled.
    return compact(this.state.plugins.map(plugin => plugin.enabled && plugin.slug));
  }

  get unmigratableReposByOrg() {
    // Group by [GitHub|BitBucket|VSTS] Org name
    return groupBy(this.state.unmigratableRepos, repo => repo.name.split('/')[0]);
  }

  get providers() {
    // Adds a list of `integrations` (installed Integration records)
    // for each Provider, as well as an `isInstalled` boolean denoting
    // when at least one Integration is present.
    return this.state.config.providers.map(provider => {
      const integrations = this.state.integrations.filter(
        i => i.provider.key === provider.key
      );
      const isInstalled = integrations.length > 0;

      return {
        ...provider,
        integrations,
        isInstalled,
      };
    });
  }

  // Actions

  onInstall = integration => {
    // Merge the new integration into the list. If we're updating an
    // integration overwrite the old integration.
    const keyedItems = keyBy(this.state.integrations, i => i.id);

    // Mark this integration as newlyAdded if it didn't already exist, allowing
    // us to animate the element in.
    if (!keyedItems.hasOwnProperty(integration.id)) {
      integration.newlyAdded = true;
    }

    const integrations = sortArray(
      Object.values({...keyedItems, [integration.id]: integration}),
      i => i.name
    );
    this.setState({integrations});
  };

  onRemove = integration => {
    const {orgId} = this.props.params;

    const origIntegrations = [...this.state.integrations];

    const integrations = this.state.integrations.filter(i => i.id !== integration.id);
    this.setState({integrations});

    const options = {
      method: 'DELETE',
      error: () => {
        this.setState({integrations: origIntegrations});
        addErrorMessage(t('Failed to remove Integration'));
      },
    };

    this.api.request(`/organizations/${orgId}/integrations/${integration.id}/`, options);
  };

  onDisable = integration => {
    let url;
    const [domainName, orgName] = integration.domainName.split('/');

    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations/`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
    }

    window.open(url, '_blank');
  };

  // Rendering

  renderProvider(provider) {
    return (
      <ProviderRow
        key={`row-${provider.key}`}
        data-test-id="integration-row"
        provider={provider}
        orgId={this.props.params.orgId}
        integrations={provider.integrations}
        onInstall={this.onInstall}
        onRemove={this.onRemove}
        onDisable={this.onDisable}
        onReinstall={this.onInstall}
        enabledPlugins={this.enabledPlugins}
      />
    );
  }

  renderSentryApps(apps, key) {
    const {organization} = this.props;
    const {appInstalls} = this.state;

    return (
      <SentryAppInstallations
        key={`sentry-app-row-${key}`}
        data-test-id="integration-row"
        api={this.api}
        organization={organization}
        installs={appInstalls}
        applications={apps}
      />
    );
  }

  renderInternalSentryApps(app, key) {
    const {organization} = this.props;

    return (
      <SentryApplicationRow
        key={`sentry-app-row-${key}`}
        data-test-id="internal-integration-row"
        api={this.api}
        showPublishStatus
        isInternal
        onRemoveApp={() => this.onRemoveInternalApp(app)}
        organization={organization}
        app={app}
      />
    );
  }

  onRemoveInternalApp = app => {
    const apps = this.state.orgOwnedApps.filter(a => a.slug !== app.slug);
    removeSentryApp(this.api, app).then(
      () => {
        this.setState({orgOwnedApps: apps});
      },
      () => {}
    );
  };

  renderBody() {
    const {reloading, orgOwnedApps, publishedApps, appInstalls} = this.state;
    const published = publishedApps || [];
    // we dont want the app to render twice if its the org that created
    // the published app.
    const orgOwned = orgOwnedApps.filter(app => {
      return !published.find(p => p.slug === app.slug);
    });
    const orgOwnedInternal = orgOwned.filter(app => {
      return app.status === 'internal';
    });
    const applications = published.concat(orgOwned.filter(a => a.status !== 'internal'));

    const installedProviders = this.providers
      .filter(p => p.isInstalled)
      .map(p => [p.name, this.renderProvider(p)]);

    const uninstalledProviders = this.providers
      .filter(p => !p.isInstalled)
      .map(p => [p.name, this.renderProvider(p)]);

    const installedSentryApps = (applications || [])
      .filter(a => appInstalls.find(i => i.app.slug === a.slug))
      .map(a => [a.name, this.renderSentryApps([a], a.slug)]);

    const uninstalledSentryApps = (applications || [])
      .filter(a => !appInstalls.find(i => i.app.slug === a.slug))
      .map(a => [a.name, this.renderSentryApps([a], a.slug)]);

    const internalSentryApps = (orgOwnedInternal || []).map(a => [
      this.renderInternalSentryApps(a, a.slug),
    ]);

    // Combine the list of Providers and Sentry Apps that have installations.
    const installed = installedProviders
      .concat(installedSentryApps)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(i => i[1]);

    // Combine the list of Providers and Sentry Apps that have no installations.
    const uninstalled = uninstalledProviders
      .concat(uninstalledSentryApps)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(i => i[1]);

    return (
      <React.Fragment>
        {!this.props.hideHeader && <SettingsPageHeader title={t('Integrations')} />}
        <PermissionAlert access={['org:integrations']} />

        <MigrationWarnings
          orgId={this.props.params.orgId}
          providers={this.providers}
          onInstall={this.onInstall}
        />

        <Panel>
          <PanelHeader disablePadding>
            <Box px={2} flex="1">
              {t('Integrations')}
            </Box>
            {reloading && <StyledLoadingIndicator mini />}
          </PanelHeader>
          <PanelBody>
            {installed}
            {uninstalled}
          </PanelBody>
        </Panel>

        {internalSentryApps.length > 0 && (
          <Panel>
            <PanelHeader disablePadding>
              <Box px={2} flex="1">
                {t('Internal Integrations')}
              </Box>
              {reloading && <StyledLoadingIndicator mini />}
            </PanelHeader>
            <PanelBody>{internalSentryApps}</PanelBody>
          </Panel>
        )}
      </React.Fragment>
    );
  }
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-16px);
`;

export default withOrganization(OrganizationIntegrations);
export {OrganizationIntegrations};
