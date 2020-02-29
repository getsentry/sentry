import groupBy from 'lodash/groupBy';
import debounce from 'lodash/debounce';
import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {
  Organization,
  Integration,
  SentryApp,
  IntegrationProvider,
  SentryAppInstallation,
  PluginWithProjectList,
} from 'app/types';
import {Panel, PanelBody} from 'app/components/panels';
import {
  trackIntegrationEvent,
  getSentryAppInstallStatus,
} from 'app/utils/integrationUtil';
import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';
import SearchInput from 'app/components/forms/searchInput';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import space from 'app/styles/space';

import IntegrationRow from './integrationRow';

type AppOrProviderOrPlugin = SentryApp | IntegrationProvider | PluginWithProjectList;

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  hideHeader: boolean;
};

type State = {
  integrations: Integration[];
  newlyInstalledIntegrationId: string;
  plugins: PluginWithProjectList[];
  appInstalls: SentryAppInstallation[];
  orgOwnedApps: SentryApp[];
  publishedApps: SentryApp[];
  config: {providers: IntegrationProvider[]};
  extraApp?: SentryApp;
  searchInput: string;
  list: AppOrProviderOrPlugin[];
  displayedList: AppOrProviderOrPlugin[];
};

function isSentryApp(integration: AppOrProviderOrPlugin): integration is SentryApp {
  return !!(integration as SentryApp).uuid;
}

function isPlugin(
  integration: AppOrProviderOrPlugin
): integration is PluginWithProjectList {
  return integration.hasOwnProperty('shortName');
}

const TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS = 1000;

export class OrganizationIntegrations extends AsyncComponent<
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

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      list: [],
      displayedList: [],
    };
  }

  onLoadAllEndpointsSuccess() {
    const {publishedApps, orgOwnedApps, extraApp, plugins} = this.state;
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

    const combined = ([] as AppOrProviderOrPlugin[])
      .concat(published)
      .concat(orgOwned)
      .concat(this.providers)
      .concat(plugins);

    const list = this.sortIntegrations(combined);

    this.setState({list, displayedList: list}, () => this.trackPageViewed());
  }

  trackPageViewed() {
    //count the number of installed apps

    const {integrations, publishedApps, plugins} = this.state;
    const integrationsInstalled = new Set();
    //add installed integrations
    integrations.forEach((integration: Integration) => {
      integrationsInstalled.add(integration.provider.key);
    });
    //add sentry apps
    publishedApps.filter(this.getAppInstall).forEach((sentryApp: SentryApp) => {
      integrationsInstalled.add(sentryApp.slug);
    });
    //add plugins
    plugins.forEach((plugin: PluginWithProjectList) => {
      if (plugin.projectList.length) {
        integrationsInstalled.add(plugin.slug);
      }
    });
    trackIntegrationEvent(
      {
        eventKey: 'integrations.index_viewed',
        eventName: 'Integrations: Index Page Viewed',
        integrations_installed: integrationsInstalled.size,
        view: 'integrations_directory',
      },
      this.props.organization,
      {startSession: true}
    );
  }

  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId} = this.props.params;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integrations', `/organizations/${orgId}/integrations/`],
      ['orgOwnedApps', `/organizations/${orgId}/sentry-apps/`],
      ['publishedApps', '/sentry-apps/', {query: {status: 'published'}}],
      ['appInstalls', `/organizations/${orgId}/sentry-app-installations/`],
      ['plugins', `/organizations/${orgId}/plugins/configs/`],
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

  get unmigratableReposByOrg() {
    // Group by [GitHub|BitBucket|VSTS] Org name
    return groupBy(this.state.unmigratableRepos, repo => repo.name.split('/')[0]);
  }

  get providers(): IntegrationProvider[] {
    return this.state.config.providers;
  }

  getAppInstall = (app: SentryApp) => {
    return this.state.appInstalls.find(i => i.app.slug === app.slug);
  };

  //Returns 0 if uninstalled, 1 if pending, and 2 if installed
  getInstallValue(integration: AppOrProviderOrPlugin) {
    const {integrations} = this.state;
    if (isSentryApp(integration)) {
      const install = this.getAppInstall(integration);
      if (install) {
        return install.status === 'pending' ? 1 : 2;
      }
      return 0;
    } else if (isPlugin(integration)) {
      return integration.projectList.length > 0 ? 2 : 0;
    }
    return integrations.find(i => i.provider.key === integration.key) ? 2 : 0;
  }

  sortIntegrations(integrations: AppOrProviderOrPlugin[]) {
    return integrations
      .sort((a, b) => a.name.localeCompare(b.name))
      .sort((a, b) => this.getInstallValue(b) - this.getInstallValue(a));
  }

  async componentDidUpdate(_, prevState: State) {
    if (this.state.list.length !== prevState.list.length) {
      await this.createSearch();
    }
  }

  async createSearch() {
    const {list} = this.state;
    this.setState({
      fuzzy: await createFuzzySearch(list || [], {
        threshold: 0.1,
        location: 0,
        distance: 100,
        keys: ['slug', 'key', 'name', 'id'],
      }),
    });
  }

  debouncedTrackIntegrationSearch = debounce((search: string, numResults: number) => {
    trackIntegrationEvent(
      {
        eventKey: 'integrations.directory_item_searched',
        eventName: 'Integrations: Directory Item Searched',
        view: 'integrations_directory',
        search_term: search,
        num_results: numResults,
      },
      this.props.organization
    );
  }, TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS);

  onSearchChange = async ({target}) => {
    this.setState({searchInput: target.value}, () => {
      if (!target.value) {
        return this.setState({displayedList: this.state.list});
      }
      const result = this.state.fuzzy && this.state.fuzzy.search(target.value);
      this.debouncedTrackIntegrationSearch(target.value, result.length);
      return this.setState({
        displayedList: this.sortIntegrations(result.map(i => i.item)),
      });
    });
  };

  // Rendering
  renderProvider = (provider: IntegrationProvider) => {
    const {organization} = this.props;
    //find the integration installations for that provider
    const integrations = this.state.integrations.filter(
      i => i.provider.key === provider.key
    );

    return (
      <IntegrationRow
        key={`row-${provider.key}`}
        data-test-id="integration-row"
        organization={organization}
        type="firstParty"
        slug={provider.slug}
        displayName={provider.name}
        status={integrations.length ? 'Installed' : 'Not Installed'}
        publishStatus="published"
        configurations={integrations.length}
      />
    );
  };

  renderPlugin = (plugin: PluginWithProjectList) => {
    const {organization} = this.props;

    const isLegacy = plugin.isHidden;
    const displayName = `${plugin.name} ${!!isLegacy ? '(Legacy)' : ''}`;
    //hide legacy integrations if we don't have any projects with them
    if (isLegacy && !plugin.projectList.length) {
      return null;
    }
    return (
      <IntegrationRow
        key={`row-plugin-${plugin.id}`}
        data-test-id="integration-row"
        organization={organization}
        type="plugin"
        slug={plugin.slug}
        displayName={displayName}
        status={plugin.projectList.length ? 'Installed' : 'Not Installed'}
        publishStatus="published"
        configurations={plugin.projectList.length}
      />
    );
  };

  //render either an internal or non-internal app
  renderSentryApp = (app: SentryApp) => {
    const {organization} = this.props;
    const status = getSentryAppInstallStatus(this.getAppInstall(app));

    return (
      <IntegrationRow
        key={`sentry-app-row-${app.slug}`}
        data-test-id="integration-row"
        organization={organization}
        type="sentryApp"
        slug={app.slug}
        displayName={app.name}
        status={status}
        publishStatus={app.status}
        configurations={0}
      />
    );
  };

  renderIntegration = (integration: AppOrProviderOrPlugin) => {
    if (isSentryApp(integration)) {
      return this.renderSentryApp(integration);
    } else if (isPlugin(integration)) {
      return this.renderPlugin(integration);
    }
    return this.renderProvider(integration);
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {displayedList} = this.state;

    const title = t('Integrations');
    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={orgId} />

        {!this.props.hideHeader && (
          <SettingsPageHeader
            title={title}
            action={
              <SearchInput
                value={this.state.searchInput || ''}
                onChange={this.onSearchChange}
                placeholder="Search Integrations..."
                width="25em"
              />
            }
          />
        )}

        <PermissionAlert access={['org:integrations']} />
        <Panel>
          <PanelBody>
            {displayedList.length ? (
              displayedList.map(this.renderIntegration)
            ) : (
              <EmptyResultsContainer>
                <EmptyResultsBody>
                  {tct('No Integrations found for "[searchTerm]".', {
                    searchTerm: this.state.searchInput,
                  })}
                </EmptyResultsBody>
              </EmptyResultsContainer>
            )}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

const EmptyResultsContainer = styled('div')`
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const EmptyResultsBody = styled('div')`
  font-size: 16px;
  line-height: 28px;
  color: ${p => p.theme.gray2};
  padding-bottom: ${space(2)};
`;

export default withOrganization(OrganizationIntegrations);
