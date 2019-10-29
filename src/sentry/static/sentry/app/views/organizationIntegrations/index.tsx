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
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import MigrationWarnings from 'app/views/organizationIntegrations/migrationWarnings';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import ProviderRow from 'app/views/organizationIntegrations/providerRow';
import {removeSentryApp} from 'app/actionCreators/sentryApps';
import SentryAppInstallationDetail from 'app/views/organizationIntegrations/sentryAppInstallationDetail';
import SentryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';
import {
  Organization,
  Integration,
  Plugin,
  SentryApp,
  IntegrationProvider,
  SentryAppInstallation,
  RouterProps,
} from 'app/types';
import {RequestOptions} from 'app/api';

type AppOrProvider = SentryApp | IntegrationProvider;

type Props = RouterProps & {
  organization: Organization;
  hideHeader: boolean;
};

type State = {
  integrations: Integration[];
  newlyInstalledIntegrationId: string;
  plugins: Plugin[];
  appInstalls: SentryAppInstallation[];
  orgOwnedApps: SentryApp[];
  publishedApps: SentryApp[];
  config: {providers: IntegrationProvider[]};
  extraApp?: SentryApp;
};

function isSentryApp(integration: AppOrProvider): integration is SentryApp {
  return (integration as SentryApp).uuid !== undefined;
}

class OrganizationIntegrations extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
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

  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId} = this.props.params;
    const query = {plugins: ['vsts', 'github', 'bitbucket']};
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integrations', `/organizations/${orgId}/integrations/`],
      ['plugins', `/organizations/${orgId}/plugins/`, {query}],
      ['orgOwnedApps', `/organizations/${orgId}/sentry-apps/`],
      ['publishedApps', '/sentry-apps/', {query: {status: 'published'}}],
      ['appInstalls', `/organizations/${orgId}/sentry-app-installations/`],
    ];
    /**
     * optional app to load for super users
     * should only be done for unpublished integrations from another org
     * but no checks are in place to ensure the above condition
     */
    const extraAppSlug = new URLSearchParams(this.props.location.search).get('extra_app');
    if (extraAppSlug) {
      baseEndpoints.push(['extraApp', `/sentry-apps/${extraAppSlug}/`]);
    }

    return baseEndpoints;
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

  get providers(): IntegrationProvider[] {
    return this.state.config.providers;
  }

  // Actions

  onInstall = (integration: Integration) => {
    // Merge the new integration into the list. If we're updating an
    // integration overwrite the old integration.
    const keyedItems = keyBy(this.state.integrations, i => i.id);

    // Mark this integration as newlyAdded if it didn't already exist, allowing
    // us to animate the element in.
    if (!keyedItems.hasOwnProperty(integration.id)) {
      this.setState({newlyInstalledIntegrationId: integration.id});
    }

    const integrations = sortArray(
      Object.values({...keyedItems, [integration.id]: integration}),
      i => i.name
    );
    this.setState({integrations});
  };

  onRemove = (integration: Integration) => {
    const {orgId} = this.props.params;

    const origIntegrations = [...this.state.integrations];

    const integrations = this.state.integrations.filter(i => i.id !== integration.id);
    this.setState({integrations});

    const options: RequestOptions = {
      method: 'DELETE',
      error: () => {
        this.setState({integrations: origIntegrations});
        addErrorMessage(t('Failed to remove Integration'));
      },
    };

    this.api.request(`/organizations/${orgId}/integrations/${integration.id}/`, options);
  };

  onDisable = (integration: Integration) => {
    let url: string;
    const [domainName, orgName] = integration.domainName.split('/');

    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations/`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
    }

    window.open(url, '_blank');
  };

  handleRemoveInternalSentryApp = (app: SentryApp): void => {
    const apps = this.state.orgOwnedApps.filter(a => a.slug !== app.slug);
    removeSentryApp(this.api, app).then(
      () => {
        this.setState({orgOwnedApps: apps});
      },
      () => {}
    );
  };

  handleRemoveAppInstallation = (app: SentryApp): void => {
    const appInstalls = this.state.appInstalls.filter(i => i.app.slug !== app.slug);
    this.setState({appInstalls});
  };

  handleAppInstallation = (install: SentryAppInstallation): void => {
    this.setState({appInstalls: [install, ...this.state.appInstalls]});
  };

  getAppInstall = (app: SentryApp) => {
    return this.state.appInstalls.find(i => i.app.slug === app.slug);
  };

  //Returns 0 if uninstalled, 1 if pending, and 2 if installed
  getInstallValue(integration: AppOrProvider) {
    const {integrations} = this.state;
    if (isSentryApp(integration)) {
      const install = this.getAppInstall(integration);
      if (install) {
        return install.status === 'pending' ? 1 : 2;
      }
      return 0;
    }
    return integrations.find(i => i.provider.key === integration.key) ? 2 : 0;
  }

  sortIntegrations(integrations: AppOrProvider[]) {
    return integrations
      .sort((a, b) => a.name.localeCompare(b.name))
      .sort((a, b) => this.getInstallValue(b) - this.getInstallValue(a));
  }

  // Rendering
  renderProvider = (provider: IntegrationProvider) => {
    //find the integration installations for that provider
    const integrations = this.state.integrations.filter(
      i => i.provider.key === provider.key
    );
    return (
      <ProviderRow
        key={`row-${provider.key}`}
        data-test-id="integration-row"
        provider={provider}
        orgId={this.props.params.orgId}
        integrations={integrations}
        onInstall={this.onInstall}
        onRemove={this.onRemove}
        onDisable={this.onDisable}
        onReinstall={this.onInstall}
        enabledPlugins={this.enabledPlugins}
        newlyInstalledIntegrationId={this.state.newlyInstalledIntegrationId}
      />
    );
  };

  //render either an internal or non-internal app
  renderSentryApp = (app: SentryApp) => {
    const {organization} = this.props;

    if (app.status === 'internal') {
      return (
        <SentryApplicationRow
          key={`sentry-app-row-${app.slug}`}
          data-test-id="internal-integration-row"
          onRemoveApp={() => this.handleRemoveInternalSentryApp(app)}
          organization={organization}
          install={this.getAppInstall(app)}
          app={app}
        />
      );
    }

    return (
      <SentryAppInstallationDetail
        key={`sentry-app-row-${app.slug}`}
        data-test-id="integration-row"
        api={this.api}
        organization={organization}
        install={this.getAppInstall(app)}
        onAppUninstall={() => this.handleRemoveAppInstallation(app)}
        onAppInstall={this.handleAppInstallation}
        app={app}
      />
    );
  };

  renderIntegration = (integration: AppOrProvider) => {
    if (isSentryApp(integration)) {
      return this.renderSentryApp(integration);
    }
    return this.renderProvider(integration);
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {reloading, orgOwnedApps, publishedApps, extraApp} = this.state;
    const published = publishedApps || [];
    // If we have an extra app in state from query parameter, add it as org owned app
    if (extraApp) {
      orgOwnedApps.push(extraApp);
    }

    // we dont want the app to render twice if its the org that created
    // the published app.
    const orgOwned = orgOwnedApps.filter(app => {
      return !published.find(p => p.slug === app.slug);
    });

    /**
     * We should have three sections:
     * 1. Public apps and integrations available to everyone
     * 2. Unpublished apps available to that org
     * 3. Internal apps available to that org
     */

    const publicApps = published.concat(orgOwned.filter(a => a.status === 'published'));
    const publicIntegrations = this.sortIntegrations(
      (publicApps as AppOrProvider[]).concat(this.providers)
    );

    const unpublishedApps = this.sortIntegrations(
      orgOwned.filter(a => a.status === 'unpublished')
    );

    const orgOwnedInternal = this.sortIntegrations(
      orgOwned.filter(a => a.status === 'internal')
    );

    const title = t('Integrations');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={orgId} />
        {!this.props.hideHeader && <SettingsPageHeader title={title} />}
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
          <PanelBody>{publicIntegrations.map(this.renderIntegration)}</PanelBody>
        </Panel>

        {unpublishedApps.length > 0 && (
          <Panel>
            <PanelHeader disablePadding>
              <Box px={2} flex="1">
                {t('Unpublished Integrations')}
              </Box>
              {reloading && <StyledLoadingIndicator mini />}
            </PanelHeader>
            <PanelBody>{unpublishedApps.map(this.renderIntegration)}</PanelBody>
          </Panel>
        )}

        {orgOwnedInternal.length > 0 && (
          <Panel>
            <PanelHeader disablePadding>
              <Box px={2} flex="1">
                {t('Internal Integrations')}
              </Box>
              {reloading && <StyledLoadingIndicator mini />}
            </PanelHeader>
            <PanelBody>{orgOwnedInternal.map(this.renderIntegration)}</PanelBody>
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
