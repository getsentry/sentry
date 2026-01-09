import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import startCase from 'lodash/startCase';

import {DocIntegrationAvatar} from 'sentry/components/core/avatar/docIntegrationAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {ExternalLink} from 'sentry/components/core/link';
import {Select} from 'sentry/components/core/select';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  AppOrProviderOrPlugin,
  DocIntegration,
  Integration,
  IntegrationProvider,
  PluginWithProjectList,
  SentryApp,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {uniq} from 'sentry/utils/array/uniq';
import {
  getAlertText,
  getCategoriesForIntegration,
  getProviderIntegrationStatus,
  getSentryAppInstallStatus,
  isDocIntegration,
  isPlugin,
  isSentryApp,
  sortIntegrations,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';
import CreateIntegrationButton from 'sentry/views/settings/organizationIntegrations/createIntegrationButton';
import IntegrationRow from 'sentry/views/settings/organizationIntegrations/integrationRow';
import ReinstallAlert from 'sentry/views/settings/organizationIntegrations/reinstallAlert';

const FirstPartyIntegrationAlert = HookOrDefault({
  hookName: 'component:first-party-integration-alert',
  defaultComponent: () => null,
});

/**
 * Debounce the tracking of integration search events to avoid spamming the
 * analytics endpoint.
 */
const TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS = 1000;
const debouncedTrackIntegrationSearch = debounce(
  (props: {num_results: number; organization: Organization; search_term: string}) => {
    trackIntegrationAnalytics('integrations.directory_item_searched', {
      view: 'integrations_directory',
      ...props,
    });
  },
  TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS
);

function useIntegrationList() {
  const queryOptions = {staleTime: 0};
  const organization = useOrganization();
  const [searchParams] = useSearchParams();
  const extraAppSlug = searchParams.get('extra_app');
  const isExtraAppEnabled = !!extraAppSlug;

  const {
    data: config = {providers: []},
    isPending: isConfigPending,
    isError: isConfigError,
  } = useApiQuery<{
    providers: IntegrationProvider[];
  }>([`/organizations/${organization.slug}/config/integrations/`], queryOptions);
  const {
    data: integrations = [],
    isPending: isIntegrationsPending,
    isError: isIntegrationsError,
  } = useApiQuery<Integration[]>(
    [`/organizations/${organization.slug}/integrations/`, {query: {includeConfig: 0}}],
    queryOptions
  );
  const {
    data: orgOwnedApps = [],
    isPending: isOrgOwnedAppsPending,
    isError: isOrgOwnedAppsError,
  } = useApiQuery<SentryApp[]>(
    [`/organizations/${organization.slug}/sentry-apps/`],
    queryOptions
  );
  const {
    data: publishedApps = [],
    isPending: isPublishedAppsPending,
    isError: isPublishedAppsError,
  } = useApiQuery<SentryApp[]>(
    ['/sentry-apps/', {query: {status: 'published'}}],
    queryOptions
  );
  const {
    data: appInstalls = [],
    isPending: isAppInstallsPending,
    isError: isAppInstallsError,
  } = useApiQuery<SentryAppInstallation[]>(
    [`/organizations/${organization.slug}/sentry-app-installations/`],
    queryOptions
  );
  const {
    data: plugins = [],
    isPending: isPluginsPending,
    isError: isPluginsError,
  } = useApiQuery<PluginWithProjectList[]>(
    [`/organizations/${organization.slug}/plugins/configs/`],
    queryOptions
  );
  const {
    data: docIntegrations = [],
    isPending: isDocIntegrationsPending,
    isError: isDocIntegrationsError,
  } = useApiQuery<DocIntegration[]>(['/doc-integrations/'], queryOptions);

  // This is the only conditional query, so we need to handle the pending and error states uniquely
  const extraAppQuery = useApiQuery<SentryApp>([`/sentry-apps/${extraAppSlug ?? ''}/`], {
    ...queryOptions,
    enabled: isExtraAppEnabled,
  });
  const {data: extraApp} = extraAppQuery;
  const isExtraAppPending = isExtraAppEnabled && extraAppQuery.isPending;
  const isExtraAppError = isExtraAppEnabled && extraAppQuery.isError;

  const anyPending =
    isConfigPending ||
    isIntegrationsPending ||
    isOrgOwnedAppsPending ||
    isPublishedAppsPending ||
    isAppInstallsPending ||
    isPluginsPending ||
    isDocIntegrationsPending ||
    isExtraAppPending;

  const anyError =
    isConfigError ||
    isIntegrationsError ||
    isOrgOwnedAppsError ||
    isPublishedAppsError ||
    isAppInstallsError ||
    isPluginsError ||
    isDocIntegrationsError ||
    isExtraAppError;

  const sentryAppList = useMemo(() => {
    const list = orgOwnedApps ?? [];
    // Add the extra app if it exists
    if (extraApp) {
      list.push(extraApp);
    }
    const publishedAppSlugSet = new Set(publishedApps.map(app => app.slug));
    // Omit this organization's published apps since orgOwnedApps already includes them
    return list.filter(app => !publishedAppSlugSet.has(app.slug));
  }, [orgOwnedApps, extraApp, publishedApps]);

  const list = useMemo(() => {
    return [
      ...publishedApps,
      ...sentryAppList,
      ...config.providers,
      ...plugins,
      ...docIntegrations,
    ];
  }, [config.providers, publishedApps, sentryAppList, plugins, docIntegrations]);

  return {
    anyPending,
    anyError,
    providers: config.providers,
    docIntegrations,
    integrations,
    orgOwnedApps,
    appInstalls,
    plugins,
    publishedApps,
    list,
  };
}

export default function IntegrationListDirectory() {
  const title = t('Integrations');
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {appInstalls, anyPending, integrations, list, anyError, publishedApps, plugins} =
    useIntegrationList();

  const category = decodeScalar(location.query.category) ?? '';
  const search = decodeScalar(location.query.search) ?? '';

  const displayList = useMemo(() => {
    let listToDisplay = [...list];

    if (search) {
      listToDisplay = list.filter(integration =>
        integration.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (category) {
      listToDisplay = listToDisplay.filter(integration =>
        getCategoriesForIntegration(integration).includes(category)
      );
    }

    return sortIntegrations({
      list: listToDisplay,
      sentryAppInstalls: appInstalls,
      integrationInstalls: integrations,
    });
  }, [list, appInstalls, integrations, category, search]);

  const getAppInstall = useCallback(
    (app: SentryApp) => appInstalls.find(i => i.app.slug === app.slug),
    [appInstalls]
  );

  const onCategoryChange = useCallback(
    ({value: newCategory}: SelectOption<string>) => {
      navigate(
        {
          ...location,
          query: {...location.query, category: newCategory ? newCategory : undefined},
        },
        {replace: true}
      );
      if (newCategory) {
        trackIntegrationAnalytics('integrations.directory_category_selected', {
          view: 'integrations_directory',
          category: newCategory,
          organization,
        });
      }
    },
    [location, navigate, organization]
  );

  const onSearchChange = useCallback(
    (newSearch: string) => {
      navigate(
        {
          ...location,
          query: {...location.query, search: newSearch ? newSearch : undefined},
        },
        {replace: true}
      );
      if (newSearch) {
        debouncedTrackIntegrationSearch({
          search_term: newSearch,
          num_results: list.length,
          organization,
        });
      }
    },
    [location, navigate, organization, list.length]
  );

  /**
   * Track the page view only when all data has been loaded
   */
  useEffect(() => {
    if (!anyError && !anyPending) {
      // count the number of installed apps
      const integrationsInstalled = new Set();
      // add installed integrations
      integrations?.forEach((integration: Integration) => {
        integrationsInstalled.add(integration.provider.key);
      });
      // add sentry apps
      publishedApps?.filter(getAppInstall).forEach((sentryApp: SentryApp) => {
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
          view: 'integrations_directory',
          integrations_installed: integrationsInstalled.size,
          organization,
        },
        {startSession: true}
      );
    }
  }, [
    anyError,
    anyPending,
    organization,
    integrations,
    publishedApps,
    plugins,
    getAppInstall,
  ]);

  const renderProvider = useCallback(
    (provider: IntegrationProvider) => {
      const providerIntegrations =
        integrations?.filter(i => i.provider.key === provider.key) ?? [];
      return (
        <IntegrationRow
          key={`row-${provider.key}`}
          data-test-id="integration-row"
          organization={organization}
          type="firstParty"
          slug={provider.slug}
          displayName={provider.name}
          status={getProviderIntegrationStatus(providerIntegrations)}
          publishStatus="published"
          configurations={providerIntegrations.length}
          categories={getCategoriesForIntegration(provider)}
          alertText={getAlertText(providerIntegrations)}
          resolveText={t('Update Now')}
          customAlert={
            <FirstPartyIntegrationAlert
              integrations={providerIntegrations}
              wrapWithContainer
            />
          }
        />
      );
    },
    [organization, integrations]
  );

  const renderPlugin = useCallback(
    (plugin: PluginWithProjectList) => {
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
    },
    [organization]
  );

  const renderSentryApp = useCallback(
    (app: SentryApp) => {
      const status = getSentryAppInstallStatus(getAppInstall(app));
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
          customIcon={<SentryAppAvatar sentryApp={app} size={36} />}
        />
      );
    },
    [organization, getAppInstall]
  );

  const renderDocIntegration = useCallback(
    (doc: DocIntegration) => {
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
    },
    [organization]
  );

  const renderIntegration = useCallback(
    (integration: AppOrProviderOrPlugin) => {
      if (isSentryApp(integration)) {
        return renderSentryApp(integration);
      }
      if (isPlugin(integration)) {
        return renderPlugin(integration);
      }
      if (isDocIntegration(integration)) {
        return renderDocIntegration(integration);
      }
      return renderProvider(integration);
    },
    [renderSentryApp, renderPlugin, renderDocIntegration, renderProvider]
  );

  if (anyPending) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <IntegrationSettingsHeader
        title={title}
        list={list}
        category={category}
        onChangeCategory={onCategoryChange}
        search={search}
        onChangeSearch={onSearchChange}
      />
      <OrganizationPermissionAlert access={['org:integrations']} />
      <ReinstallAlert integrations={integrations} />
      <Panel>
        <PanelBody data-test-id="integration-panel">
          {displayList.length ? (
            displayList.map(renderIntegration)
          ) : (
            <IntegrationResultsEmpty searchTerm={search} />
          )}
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

function IntegrationSettingsHeader({
  title,
  list,
  category,
  onChangeCategory,
  search,
  onChangeSearch,
}: {
  category: string;
  list: AppOrProviderOrPlugin[];
  onChangeCategory: (categoryOption: SelectOption<string>) => void;
  onChangeSearch: (search: string) => void;
  search: string;
  title: string;
}) {
  const getCategoryLabel = useCallback((c: string) => {
    return c === 'api' ? 'API' : startCase(c);
  }, []);

  const categoryOptions: Array<SelectOption<string>> = useMemo(() => {
    const categoryList = uniq(list.flatMap(getCategoriesForIntegration))
      .sort()
      .map(c => ({value: c, label: getCategoryLabel(c)}));
    return [{value: '', label: t('All Categories')}, ...categoryList];
  }, [list, getCategoryLabel]);

  return (
    <SettingsPageHeader
      title={title}
      body={
        <ActionContainer>
          <Select
            name="select-categories"
            onChange={onChangeCategory}
            value={category}
            options={categoryOptions}
          />
          <SearchBar
            query={search}
            onSearch={onChangeSearch}
            placeholder={t('Filter Integrations\u2026')}
            aria-label={t('Filter')}
            width="100%"
            data-test-id="search-bar"
          />
        </ActionContainer>
      }
      action={<CreateIntegrationButton analyticsView="integrations_directory" />}
    />
  );
}

function IntegrationResultsEmpty({searchTerm}: {searchTerm: string}) {
  return (
    <EmptyResultsContainer>
      <EmptyResultsBody>
        {tct('No Integrations found for "[searchTerm]".', {searchTerm})}
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
  );
}

const ActionContainer = styled('div')`
  display: grid;
  grid-template-columns: 240px auto;
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
  color: ${p => p.theme.tokens.content.secondary};
  padding-bottom: ${space(2)};
`;

const EmptyResultsBodyBold = styled(EmptyResultsBody)`
  font-weight: ${p => p.theme.fontWeight.bold};
`;
