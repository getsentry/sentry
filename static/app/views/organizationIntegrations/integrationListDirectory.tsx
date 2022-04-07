import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import startCase from 'lodash/startCase';
import uniq from 'lodash/uniq';
import * as qs from 'query-string';

import AsyncComponent from 'sentry/components/asyncComponent';
import DocIntegrationAvatar from 'sentry/components/avatar/docIntegrationAvatar';
import SelectControl from 'sentry/components/forms/selectControl';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import SentryAppIcon from 'sentry/components/sentryAppIcon';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  AppOrProviderOrPlugin,
  DocIntegration,
  Integration,
  IntegrationProvider,
  Organization,
  PluginWithProjectList,
  SentryApp,
  SentryAppInstallation,
} from 'sentry/types';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';
import {
  getAlertText,
  getCategoriesForIntegration,
  getSentryAppInstallStatus,
  isDocIntegration,
  isPlugin,
  isSentryApp,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {POPULARITY_WEIGHT} from './constants';
import IntegrationRow from './integrationRow';

const FirstPartyIntegrationAlert = HookOrDefault({
  hookName: 'component:first-party-integration-alert',
  defaultComponent: () => null,
});

const fuseOptions = {
  threshold: 0.3,
  location: 0,
  distance: 100,
  includeScore: true as const,
  keys: ['slug', 'key', 'name', 'id'],
};

type Props = RouteComponentProps<{orgId: string}, {}> & {
  hideHeader: boolean;
  organization: Organization;
};

type State = {
  appInstalls: SentryAppInstallation[] | null;
  config: {providers: IntegrationProvider[]} | null;
  displayedList: AppOrProviderOrPlugin[];
  docIntegrations: DocIntegration[] | null;
  integrations: Integration[] | null;
  list: AppOrProviderOrPlugin[];
  orgOwnedApps: SentryApp[] | null;
  plugins: PluginWithProjectList[] | null;
  publishedApps: SentryApp[] | null;
  searchInput: string;
  selectedCategory: string;
  extraApp?: SentryApp;
  fuzzy?: Fuse<AppOrProviderOrPlugin>;
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
    const {publishedApps, orgOwnedApps, extraApp, plugins, docIntegrations} = this.state;
    const published = publishedApps || [];
    // If we have an extra app in state from query parameter, add it as org owned app
    if (orgOwnedApps !== null && extraApp) {
      orgOwnedApps.push(extraApp);
    }

    // we don't want the app to render twice if its the org that created
    // the published app.
    const orgOwned = orgOwnedApps?.filter(
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
      .concat(orgOwned ?? [])
      .concat(this.providers)
      .concat(plugins ?? [])
      .concat(docIntegrations ?? []);

    const list = this.sortIntegrations(combined);

    const {searchInput, selectedCategory} = this.getFilterParameters();

    this.setState({list, searchInput, selectedCategory}, () => {
      this.updateDisplayedList();
      this.trackPageViewed();
    });
  }

  trackPageViewed() {
    // count the number of installed apps

    const {integrations, publishedApps, plugins} = this.state;
    const integrationsInstalled = new Set();
    // add installed integrations
    integrations?.forEach((integration: Integration) => {
      integrationsInstalled.add(integration.provider.key);
    });
    // add sentry apps
    publishedApps?.filter(this.getAppInstall).forEach((sentryApp: SentryApp) => {
      integrationsInstalled.add(sentryApp.slug);
    });
    // add plugins
    plugins?.forEach((plugin: PluginWithProjectList) => {
      if (plugin.projectList.length) {
        integrationsInstalled.add(plugin.slug);
      }
    });
    trackIntegrationAnalytics(
      'integrations.index_viewed',
      {
        integrations_installed: integrationsInstalled.size,
        view: 'integrations_directory',
        organization: this.props.organization,
      },
      {startSession: true}
    );
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId} = this.props.params;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      ['config', `/organizations/${orgId}/config/integrations/`],
      [
        'integrations',
        `/organizations/${orgId}/integrations/`,
        {query: {includeConfig: 0}},
      ],
      ['orgOwnedApps', `/organizations/${orgId}/sentry-apps/`],
      ['publishedApps', '/sentry-apps/', {query: {status: 'published'}}],
      ['appInstalls', `/organizations/${orgId}/sentry-app-installations/`],
      ['plugins', `/organizations/${orgId}/plugins/configs/`],
      ['docIntegrations', '/doc-integrations/'],
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
    return this.state.config?.providers ?? [];
  }

  getAppInstall = (app: SentryApp) =>
    this.state.appInstalls?.find(i => i.app.slug === app.slug);

  // Returns 0 if uninstalled, 1 if pending, and 2 if installed
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

    if (isDocIntegration(integration)) {
      return 0;
    }

    return integrations?.find(i => i.provider.key === integration.key) ? 2 : 0;
  }

  getPopularityWeight = (integration: AppOrProviderOrPlugin) => {
    if (isSentryApp(integration) || isDocIntegration(integration)) {
      return integration?.popularity ?? 1;
    }
    return POPULARITY_WEIGHT[integration.slug] ?? 1;
  };

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
      // sort by whether installed first
      const diffWeight = this.sortByInstalled(a, b);
      if (diffWeight !== 0) {
        return diffWeight;
      }
      // then sort by popularity
      const diffPop = this.sortByPopularity(a, b);
      if (diffPop !== 0) {
        return diffPop;
      }
      // then sort by name
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
      fuzzy: await createFuzzySearch(list || [], fuseOptions),
    });
  }

  debouncedTrackIntegrationSearch = debounce((search: string, numResults: number) => {
    trackIntegrationAnalytics('integrations.directory_item_searched', {
      view: 'integrations_directory',
      search_term: search,
      num_results: numResults,
      organization: this.props.organization,
    });
  }, TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS);

  /**
   * Get filter parameters and guard against `qs.parse` returning arrays.
   */
  getFilterParameters = (): {searchInput: string; selectedCategory: string} => {
    const {category, search} = qs.parse(this.props.location.search);

    const selectedCategory = Array.isArray(category) ? category[0] : category || '';
    const searchInput = Array.isArray(search) ? search[0] : search || '';

    return {searchInput, selectedCategory};
  };

  /**
   * Update the query string with the current filter parameter values.
   */
  updateQueryString = () => {
    const {searchInput, selectedCategory} = this.state;

    const searchString = qs.stringify({
      ...qs.parse(this.props.location.search),
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
        trackIntegrationAnalytics('integrations.directory_category_selected', {
          view: 'integrations_directory',
          category,
          organization: this.props.organization,
        });
      }
    });
  };

  // Rendering
  renderProvider = (provider: IntegrationProvider) => {
    const {organization} = this.props;
    // find the integration installations for that provider
    const integrations =
      this.state.integrations?.filter(i => i.provider.key === provider.key) ?? [];

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
        categories={getCategoriesForIntegration(provider)}
        alertText={getAlertText(integrations)}
        resolveText={t('Update Now')}
        customAlert={
          <FirstPartyIntegrationAlert integrations={integrations} wrapWithContainer />
        }
      />
    );
  };

  renderPlugin = (plugin: PluginWithProjectList) => {
    const {organization} = this.props;
    const isLegacy = plugin.isHidden;
    const displayName = `${plugin.name} ${isLegacy ? '(Legacy)' : ''}`;
    // hide legacy integrations if we don't have any projects with them
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
        plugin={plugin}
      />
    );
  };

  // render either an internal or non-internal app
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
        customIcon={<SentryAppIcon sentryApp={app} size={36} />}
      />
    );
  };

  renderDocIntegration = (doc: DocIntegration) => {
    const {organization} = this.props;
    return (
      <IntegrationRow
        key={`doc-int-${doc.slug}`}
        data-test-id="integration-row"
        organization={organization}
        type="docIntegration"
        slug={doc.slug}
        displayName={doc.name}
        publishStatus="published"
        configurations={0}
        categories={getCategoriesForIntegration(doc)}
        customIcon={<DocIntegrationAvatar docIntegration={doc} size={36} />}
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
    if (isDocIntegration(integration)) {
      return this.renderDocIntegration(integration);
    }
    return this.renderProvider(integration);
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {displayedList, list, searchInput, selectedCategory} = this.state;

    const title = t('Integrations');
    const categoryList = uniq(flatten(list.map(getCategoriesForIntegration))).sort();

    return (
      <Fragment>
        <SentryDocumentTitle title={title} orgSlug={orgId} />

        {!this.props.hideHeader && (
          <SettingsPageHeader
            title={title}
            action={
              <ActionContainer>
                <SelectControl
                  name="select-categories"
                  onChange={this.onCategorySelect}
                  value={selectedCategory}
                  options={[
                    {value: '', label: t('All Categories')},
                    ...categoryList.map(category => ({
                      value: category,
                      label: startCase(category),
                    })),
                  ]}
                />
                <SearchBar
                  query={searchInput || ''}
                  onChange={this.handleSearchChange}
                  placeholder={t('Filter Integrations...')}
                  width="25em"
                  data-test-id="search-bar"
                />
              </ActionContainer>
            }
          />
        )}

        <PermissionAlert access={['org:integrations']} />
        <Panel>
          <PanelBody data-test-id="integration-panel">
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
                      <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/" />
                    ),
                  })}
                </EmptyResultsBody>
              </EmptyResultsContainer>
            )}
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}

const ActionContainer = styled('div')`
  display: grid;
  grid-template-columns: 240px max-content;
  gap: ${space(2)};
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
  color: ${p => p.theme.gray300};
  padding-bottom: ${space(2)};
`;

const EmptyResultsBodyBold = styled(EmptyResultsBody)`
  font-weight: bold;
`;

export default withOrganization(IntegrationListDirectory);
