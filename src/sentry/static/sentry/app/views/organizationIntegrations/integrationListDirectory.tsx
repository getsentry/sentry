import groupBy from 'lodash/groupBy';
import keyBy from 'lodash/keyBy';
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
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {RequestOptions} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import {removeSentryApp} from 'app/actionCreators/sentryApps';
import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import LoadingIndicator from 'app/components/loadingIndicator';
import MigrationWarnings from 'app/views/organizationIntegrations/migrationWarnings';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import SearchInput from 'app/components/forms/searchInput';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
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

    const {integrations, publishedApps} = this.state;
    const integrationsInstalled = new Set();
    //add installed integrations
    integrations.forEach((integration: Integration) => {
      integrationsInstalled.add(integration.provider.key);
    });
    //add sentry apps
    publishedApps.filter(this.getAppInstall).forEach((sentryApp: SentryApp) => {
      integrationsInstalled.add(sentryApp.slug);
    });
    trackIntegrationEvent(
      {
        eventKey: 'integrations.index_viewed',
        eventName: 'Integrations: Index Page Viewed',
        integrations_installed: integrationsInstalled.size,
        view: 'integrations_page',
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

  getAppInstall = (app: SentryApp) => {
    return this.state.appInstalls.find(i => i.app.slug === app.slug);
  };

  getInstalled = (app: SentryApp) => {
    const install = this.getAppInstall(app);
    if (install) {
      return [install];
    }
    return [];
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

  onSearchChange = async ({target}) => {
    this.setState({searchInput: target.value}, () => {
      if (!target.value) {
        return this.setState({displayedList: this.state.list});
      }
      const result = this.state.fuzzy && this.state.fuzzy.search(target.value);
      return this.setState({
        displayedList: this.sortIntegrations(result.map(i => i.item)),
      });
    });
  };
  // Rendering
  renderProvider = (provider: IntegrationProvider) => {
    //find the integration installations for that provider
    const integrations = this.state.integrations.filter(
      i => i.provider.key === provider.key
    );
    return (
      <IntegrationRow
        key={`row-${provider.key}`}
        data-test-id="integration-row"
        integration={provider}
        installed={integrations}
        organization={this.props.organization}
        type="provider"
      />
    );
  };

  renderPlugin = (plugin: PluginWithProjectList) => {
    const legacyIds = [
      'jira',
      'bitbucket',
      'github',
      'gitlab',
      'slack',
      'pagerduty',
      'clubhouse',
      'vsts',
    ];
    const isLegacy = legacyIds.includes(plugin.id);
    //hide legacy integrations if we don't have any projects with them
    if (isLegacy && !plugin.projectList.length) {
      return null;
    }
    return (
      <IntegrationRow
        key={`row-plugin-${plugin.id}`}
        data-test-id="integration-row"
        integration={plugin}
        installed={plugin.projectList}
        isLegacy={isLegacy}
        organization={this.props.organization}
        type="plugin"
      />
    );
  };

  //render either an internal or non-internal app
  renderSentryApp = (app: SentryApp) => {
    const {organization} = this.props;

    return (
      <IntegrationRow
        key={`sentry-app-row-${app.slug}`}
        data-test-id="integration-row"
        organization={organization}
        integration={app}
        installed={this.getInstalled(app)}
        type="sentry-app"
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
    const {reloading, displayedList} = this.state;

    const title = t('Integrations');
    const tags = [
      'Source Control',
      'Ticketing',
      'Data Forwarding',
      'Release Management',
      'Notifications',
    ];
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
        <SearchInput
          value={this.state.searchInput || ''}
          onChange={this.onSearchChange}
          placeholder="Find a new integration, or one you already use."
          width="100%"
        />
        <TagsContainer>
          {tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </TagsContainer>
        <Panel>
          <PanelHeader disablePadding>
            <Heading>{t('Integrations')}</Heading>
            {reloading && <StyledLoadingIndicator mini />}
          </PanelHeader>
          <PanelBody>{displayedList.map(this.renderIntegration)}</PanelBody>
        </Panel>
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

const Heading = styled('div')`
  flex: 1;
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const TagsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  padding-top: ${space(3)};
  padding-bottom: ${space(1)};
`;

const Tag = styled('span')`
  transition: border-color 0.15s ease;
  font-size: 14px;
  line-height: 1;
  padding: ${space(1)};
  margin: 0 ${space(1)} ${space(1)} 0;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: 30px;
  height: 28px;
  box-shadow: inset ${p => p.theme.dropShadowLight};
  cursor: pointer;

  &:focus {
    outline: none;
    border: 1px solid ${p => p.theme.gray1};
  }

  &::placeholder {
    color: ${p => p.theme.gray2};
  }
`;

export default withOrganization(OrganizationIntegrations);
export {OrganizationIntegrations};
