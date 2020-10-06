import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import startCase from 'lodash/startCase';
import uniq from 'lodash/uniq';
import * as queryString from 'query-string';
import React from 'react';
import {browserHistory} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';

import Feature from 'app/components/acl/feature';
import AsyncComponent from 'app/components/asyncComponent';
import SelectControl from 'app/components/forms/selectControl';
import {Panel, PanelBody} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  AppOrProviderOrPlugin,
  DocumentIntegration,
  Integration,
  IntegrationProvider,
  Organization,
  PluginWithProjectList,
  SentryApp,
  SentryAppInstallation,
} from 'app/types';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import {
  getCategoriesForIntegration,
  getReauthAlertText,
  getSentryAppInstallStatus,
  isDocumentIntegration,
  isPlugin,
  isSentryApp,
  isSlackWorkspaceApp,
  trackIntegrationEvent,
} from 'app/utils/integrationUtil';
import withOrganization from 'app/utils/withOrganization';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

import {documentIntegrations, POPULARITY_WEIGHT} from './constants';
import IntegrationRow from './integrationRow';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  hideHeader: boolean;
};

type State = {
  integrations: Integration[];
  plugins: PluginWithProjectList[];
  appInstalls: SentryAppInstallation[];
  orgOwnedApps: SentryApp[];
  publishedApps: SentryApp[];
  config: {providers: IntegrationProvider[]};
  extraApp?: SentryApp;
  searchInput: string;
  list: AppOrProviderOrPlugin[];
  displayedList: AppOrProviderOrPlugin[];
  selectedCategory: string;
};

const TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS = 1000;

export class IntegrationListDirectory extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
  // Some integrations require visiting a different website to add them. When
  // we come back to the tab we want to show our integrations as soon as we can.
  shouldReload = true;
  reloadOnVisible = true;
  shouldReloadOnVisible = true;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      list: [],
      displayedList: [],
      selectedCategory: '',
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
    const orgOwned = orgOwnedApps.filter(
      app => !published.find(p => p.slug === app.slug)
    );

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
      .concat(plugins)
      .concat(Object.values(documentIntegrations));

    const list = this.sortIntegrations(combined);

    const {searchInput, selectedCategory} = this.getFilterParameters();

    this.setState({list, searchInput, selectedCategory}, () => {
      this.updateDisplayedList();
      this.trackPageViewed();
    });
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
      [
        'integrations',
        `/organizations/${orgId}/integrations/`,
        {query: {include_config: 0}},
      ],
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

  getAppInstall = (app: SentryApp) =>
    this.state.appInstalls.find(i => i.app.slug === app.slug);

  //Returns 0 if uninstalled, 1 if pending, and 2 if installed
  getInstallValue(integration: AppOrProviderOrPlugin) {
    const {integrations} = this.state;

    if (isPlugin(integration)) {
      return integration.projectList.length > 0 ? 2 : 0;
    }

    if (isSentryApp(integration)) {
      const install = this.getAppInstall(integration);
      if (install) {
        return install.status === 'pending' ? 1 : 2;
      }
      return 0;
    }

    if (isDocumentIntegration(integration)) {
      return 0;
    }

    return integrations.find(i => i.provider.key === integration.key) ? 2 : 0;
  }

  getPopularityWeight = (integration: AppOrProviderOrPlugin) =>
    POPULARITY_WEIGHT[integration.slug] ?? 1;

  sortByName = (a: AppOrProviderOrPlugin, b: AppOrProviderOrPlugin) =>
    a.slug.localeCompare(b.slug);

  sortByPopularity = (a: AppOrProviderOrPlugin, b: AppOrProviderOrPlugin) => {
    const weightA = this.getPopularityWeight(a);
    const weightB = this.getPopularityWeight(b);
    return weightB - weightA;
  };

  sortByInstalled = (a: AppOrProviderOrPlugin, b: AppOrProviderOrPlugin) =>
    this.getInstallValue(b) - this.getInstallValue(a);

  sortIntegrations(integrations: AppOrProviderOrPlugin[]) {
    return integrations.sort((a: AppOrProviderOrPlugin, b: AppOrProviderOrPlugin) => {
      //sort by whether installed first
      const diffWeight = this.sortByInstalled(a, b);
      if (diffWeight !== 0) {
        return diffWeight;
      }
      //then sort by popularity
      const diffPop = this.sortByPopularity(a, b);
      if (diffPop !== 0) {
        return diffPop;
      }
      //then sort by name
      return this.sortByName(a, b);
    });
  }

  async componentDidUpdate(_: Props, prevState: State) {
    if (this.state.list.length !== prevState.list.length) {
      await this.createSearch();
    }
  }

  async createSearch() {
    const {list} = this.state;
    this.setState({
      fuzzy: await createFuzzySearch(list || [], {
        threshold: 0.3,
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

  /**
   * Get filter parameters and guard against `queryString.parse` returning arrays.
   */
  getFilterParameters = (): {searchInput: string; selectedCategory: string} => {
    const {category, search} = queryString.parse(this.props.location.search);

    const selectedCategory = Array.isArray(category) ? category[0] : category || '';
    const searchInput = Array.isArray(search) ? search[0] : search || '';

    return {searchInput, selectedCategory};
  };

  /**
   * Update the query string with the current filter parameter values.
   */
  updateQueryString = () => {
    const {searchInput, selectedCategory} = this.state;

    const searchString = queryString.stringify({
      ...queryString.parse(this.props.location.search),
      search: searchInput ? searchInput : undefined,
      category: selectedCategory ? selectedCategory : undefined,
    });

    browserHistory.replace({
      pathname: this.props.location.pathname,
      search: searchString ? `?${searchString}` : undefined,
    });
  };

  /**
   * Filter the integrations list by ANDing together the search query and the category select.
   */
  updateDisplayedList = (): AppOrProviderOrPlugin[] => {
    const {fuzzy, list, searchInput, selectedCategory} = this.state;

    let displayedList = list;

    if (searchInput && fuzzy) {
      const searchResults = fuzzy.search(searchInput);
      displayedList = this.sortIntegrations(searchResults.map(i => i.item));
    }

    if (selectedCategory) {
      displayedList = displayedList.filter(integration =>
        getCategoriesForIntegration(integration).includes(selectedCategory)
      );
    }

    this.setState({displayedList});

    return displayedList;
  };

  handleSearchChange = async (value: string) => {
    this.setState({searchInput: value}, () => {
      this.updateQueryString();
      const result = this.updateDisplayedList();
      if (value) {
        this.debouncedTrackIntegrationSearch(value, result.length);
      }
    });
  };

  onCategorySelect = ({value: category}: {value: string}) => {
    this.setState({selectedCategory: category}, () => {
      this.updateQueryString();
      this.updateDisplayedList();

      if (category) {
        trackIntegrationEvent(
          {
            eventKey: 'integrations.directory_category_selected',
            eventName: 'Integrations: Directory Category Selected',
            view: 'integrations_directory',
            category,
          },
          this.props.organization
        );
      }
    });
  };

  // Rendering
  renderProvider = (provider: IntegrationProvider) => {
    const {organization} = this.props;
    //find the integration installations for that provider
    const integrations = this.state.integrations.filter(
      i => i.provider.key === provider.key
    );

    const hasWorkspaceApp = integrations.some(isSlackWorkspaceApp);

    return (
      <Feature
        key={`row-${provider.key}`}
        organization={organization}
        features={['slack-migration']}
      >
        {({hasFeature}) => (
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
            categories={getCategoriesForIntegration(provider)}
            alertText={
              hasFeature && hasWorkspaceApp ? getReauthAlertText(provider) : undefined
            }
          />
        )}
      </Feature>
    );
  };

  renderPlugin = (plugin: PluginWithProjectList) => {
    const {organization} = this.props;

    const isLegacy = plugin.isHidden;
    const displayName = `${plugin.name} ${isLegacy ? '(Legacy)' : ''}`;
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
        categories={getCategoriesForIntegration(plugin)}
      />
    );
  };

  //render either an internal or non-internal app
  renderSentryApp = (app: SentryApp) => {
    const {organization} = this.props;
    const status = getSentryAppInstallStatus(this.getAppInstall(app));
    const categories = getCategoriesForIntegration(app);

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
        categories={categories}
      />
    );
  };

  renderDocumentIntegration = (integration: DocumentIntegration) => {
    const {organization} = this.props;
    return (
      <IntegrationRow
        key={`doc-int-${integration.slug}`}
        organization={organization}
        type="documentIntegration"
        slug={integration.slug}
        displayName={integration.name}
        publishStatus="published"
        configurations={0}
        categories={getCategoriesForIntegration(integration)}
      />
    );
  };

  renderIntegration = (integration: AppOrProviderOrPlugin) => {
    if (isSentryApp(integration)) {
      return this.renderSentryApp(integration);
    }
    if (isPlugin(integration)) {
      return this.renderPlugin(integration);
    }
    if (isDocumentIntegration(integration)) {
      return this.renderDocumentIntegration(integration);
    }
    return this.renderProvider(integration);
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {displayedList, list, searchInput, selectedCategory} = this.state;

    const title = t('Integrations');
    const categoryList = uniq(flatten(list.map(getCategoriesForIntegration))).sort();

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={orgId} />

        {!this.props.hideHeader && (
          <SettingsPageHeader
            title={title}
            action={
              <ActionContainer>
                <SelectControl
                  name="select-categories"
                  onChange={this.onCategorySelect}
                  value={selectedCategory}
                  choices={[
                    ['', t('All Categories')],
                    ...categoryList.map(category => [category, startCase(category)]),
                  ]}
                />
                <SearchBar
                  query={searchInput || ''}
                  onChange={this.handleSearchChange}
                  placeholder={t('Filter Integrations...')}
                  width="25em"
                />
              </ActionContainer>
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
                    searchTerm: searchInput,
                  })}
                </EmptyResultsBody>
                <EmptyResultsBodyBold>
                  {t("Not seeing what you're looking for?")}
                </EmptyResultsBodyBold>
                <EmptyResultsBody>
                  {tct('[link:Build it on the Sentry Integration Platform.]', {
                    link: (
                      <a href="https://docs.sentry.io/workflow/integrations/integration-platform/" />
                    ),
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

const ActionContainer = styled('div')`
  display: grid;
  grid-template-columns: 240px max-content;
  grid-gap: ${space(2)};
`;

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
  color: ${p => p.theme.gray500};
  padding-bottom: ${space(2)};
`;

const EmptyResultsBodyBold = styled(EmptyResultsBody)`
  font-weight: bold;
`;

export default withOrganization(IntegrationListDirectory);
