import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import startCase from 'lodash/startCase';

import {DocIntegrationAvatar, SentryAppAvatar} from '@sentry/scraps/avatar';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';

import {
  sentryAppApiOptions,
  sentryAppsApiOptions,
} from 'sentry/actionCreators/sentryApps';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t, tct} from 'sentry/locale';
import type {
  AppOrProviderOrPlugin,
  DocIntegration,
  Integration,
  IntegrationProvider,
  SentryApp,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {uniq} from 'sentry/utils/array/uniq';
import {
  getCategoriesForIntegration,
  getIntegrationStatus,
  getProviderIntegrationStatus,
  getSentryAppInstallStatus,
  integrationRequiresUpgrade,
  isDocIntegration,
  isSentryApp,
  sortIntegrations,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';
import {CreateIntegrationButton} from 'sentry/views/settings/organizationIntegrations/createIntegrationButton';
import {IntegrationRow} from 'sentry/views/settings/organizationIntegrations/integrationRow';
import {ReinstallAlert} from 'sentry/views/settings/organizationIntegrations/reinstallAlert';
import {legacyWebhooksQueryOptions} from 'sentry/views/settings/organizationIntegrations/webhookDetailedView';

const FirstPartyIntegrationAlert = OverrideOrDefault({
  overrideName: 'component:first-party-integration-alert',
  defaultComponent: () => null,
});

const WEBHOOK_ROW_CATEGORIES = ['notification action'];

/**
 * Everything the directory renders for a search: the matching integrations
 * plus the synthetic legacy webhook row. Search analytics report numResults
 * so the count must stay in sync with what is shown.
 */
function getDisplayedResults(
  list: AppOrProviderOrPlugin[],
  search: string,
  category: string,
  hasLegacyWebhooks: boolean
) {
  const term = search.toLowerCase();
  const matches = list.filter(
    integration =>
      integration.name.toLowerCase().includes(term) &&
      (!category || getCategoriesForIntegration(integration).includes(category))
  );
  const showLegacyWebhookRow =
    hasLegacyWebhooks &&
    t('Webhooks (Legacy)').toLowerCase().includes(term) &&
    (!category || WEBHOOK_ROW_CATEGORIES.includes(category));
  return {
    matches,
    showLegacyWebhookRow,
    numResults: matches.length + (showLegacyWebhookRow ? 1 : 0),
  };
}

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
  }>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/config/integrations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    queryOptions
  );
  const {
    data: integrations = [],
    isPending: isIntegrationsPending,
    isError: isIntegrationsError,
  } = useApiQuery<Integration[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/integrations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {includeConfig: 0}},
    ],
    queryOptions
  );
  const {
    data: orgOwnedApps = [],
    isPending: isOrgOwnedAppsPending,
    isError: isOrgOwnedAppsError,
  } = useQuery(sentryAppsApiOptions({orgSlug: organization.slug}));
  const {
    data: publishedApps = [],
    isPending: isPublishedAppsPending,
    isError: isPublishedAppsError,
  } = useApiQuery<SentryApp[]>(
    [getApiUrl('/sentry-apps/'), {query: {status: 'published'}}],
    queryOptions
  );
  const {
    data: appInstalls = [],
    isPending: isAppInstallsPending,
    isError: isAppInstallsError,
  } = useApiQuery<SentryAppInstallation[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sentry-app-installations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    queryOptions
  );
  const {
    data: docIntegrations = [],
    isPending: isDocIntegrationsPending,
    isError: isDocIntegrationsError,
  } = useApiQuery<DocIntegration[]>([getApiUrl('/doc-integrations/')], queryOptions);

  const {
    data: legacyWebhooks,
    isPending: isLegacyWebhooksPending,
    isError: isLegacyWebhooksError,
  } = useQuery(legacyWebhooksQueryOptions(organization));

  // This is the only conditional query, so we need to handle the pending and error states uniquely
  const extraAppQuery = useQuery(sentryAppApiOptions({appSlug: extraAppSlug}));
  const {data: extraApp} = extraAppQuery;
  const isExtraAppPending = isExtraAppEnabled && extraAppQuery.isPending;
  const isExtraAppError = isExtraAppEnabled && extraAppQuery.isError;

  const anyPending =
    isConfigPending ||
    isIntegrationsPending ||
    isOrgOwnedAppsPending ||
    isPublishedAppsPending ||
    isAppInstallsPending ||
    isDocIntegrationsPending ||
    isExtraAppPending ||
    isLegacyWebhooksPending;

  const anyError =
    isConfigError ||
    isIntegrationsError ||
    isOrgOwnedAppsError ||
    isPublishedAppsError ||
    isAppInstallsError ||
    isDocIntegrationsError ||
    isExtraAppError ||
    isLegacyWebhooksError;

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
    return [...publishedApps, ...sentryAppList, ...config.providers, ...docIntegrations];
  }, [config.providers, publishedApps, sentryAppList, docIntegrations]);

  return {
    anyPending,
    anyError,
    providers: config.providers,
    docIntegrations,
    integrations,
    orgOwnedApps,
    appInstalls,
    publishedApps,
    list,
    legacyWebhooks,
  };
}

export default function IntegrationListDirectory() {
  const title = t('Integrations');
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    appInstalls,
    anyPending,
    integrations,
    list,
    anyError,
    publishedApps,
    legacyWebhooks,
  } = useIntegrationList();

  const category = decodeScalar(location.query.category) ?? '';
  const search = decodeScalar(location.query.search) ?? '';

  const legacyWebhookProjectCount = legacyWebhooks?.projects?.length ?? 0;

  const {displayList, showLegacyWebhookRow} = useMemo(() => {
    const results = getDisplayedResults(list, search, category, !!legacyWebhooks);
    return {
      displayList: sortIntegrations({
        list: results.matches,
        sentryAppInstalls: appInstalls,
        integrationInstalls: integrations,
      }),
      showLegacyWebhookRow: results.showLegacyWebhookRow,
    };
  }, [list, search, category, legacyWebhooks, appInstalls, integrations]);

  const getAppInstall = useCallback(
    (app: SentryApp) => appInstalls.find(i => i.app.slug === app.slug),
    [appInstalls]
  );

  const onCategoryChange = useCallback(
    ({value: newCategory}: SelectOption<string>) => {
      navigate(
        {
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
          query: {...location.query, search: newSearch ? newSearch : undefined},
        },
        {replace: true}
      );
      if (newSearch) {
        trackIntegrationAnalytics('integrations.directory_item_searched', {
          view: 'integrations_directory',
          search_term: newSearch,
          num_results: getDisplayedResults(list, newSearch, category, !!legacyWebhooks)
            .numResults,
          organization,
        });
      }
    },
    [location, navigate, organization, list, category, legacyWebhooks]
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
      // add legacy webhooks
      if (legacyWebhooks?.projects?.length) {
        integrationsInstalled.add('legacy-webhooks');
      }

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
    getAppInstall,
    legacyWebhooks,
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
          disabledConfigurations={
            providerIntegrations.filter(i => getIntegrationStatus(i) === 'disabled')
              .length
          }
          categories={getCategoriesForIntegration(provider)}
          outdatedConfigurations={
            providerIntegrations.filter(integrationRequiresUpgrade).length
          }
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
      if (isDocIntegration(integration)) {
        return renderDocIntegration(integration);
      }
      return renderProvider(integration);
    },
    [renderSentryApp, renderDocIntegration, renderProvider]
  );

  if (anyPending) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <Stack gap="xl">
        <IntegrationSettingsHeader
          title={title}
          list={list}
          category={category}
          onChangeCategory={onCategoryChange}
          search={search}
          onChangeSearch={onSearchChange}
        />
        <Stack>
          <OrganizationPermissionAlert access={['org:integrations']} />
          <ReinstallAlert integrations={integrations} />
          <Panel>
            <PanelBody data-test-id="integration-panel">
              {displayList.length || showLegacyWebhookRow ? (
                <Fragment>
                  {displayList.map(renderIntegration)}
                  {showLegacyWebhookRow && (
                    <IntegrationRow
                      key="row-legacy-webhooks"
                      data-test-id="integration-row"
                      organization={organization}
                      type="firstParty"
                      slug="legacy-webhooks"
                      displayName={t('Webhooks (Legacy)')}
                      status={legacyWebhookProjectCount ? 'Installed' : 'Not Installed'}
                      publishStatus="published"
                      configurations={legacyWebhookProjectCount}
                      categories={WEBHOOK_ROW_CATEGORIES}
                      customIcon={<PluginIcon pluginId="webhooks" size={36} />}
                    />
                  )}
                </Fragment>
              ) : (
                <IntegrationResultsEmpty searchTerm={search} />
              )}
            </PanelBody>
          </Panel>
        </Stack>
      </Stack>
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
    <Fragment>
      <SettingsPageHeader title={title} />
      <Flex align="center" gap="md">
        <Container width="240px">
          <Select
            name="select-categories"
            onChange={onChangeCategory}
            value={category}
            options={categoryOptions}
          />
        </Container>
        <Container flex={1}>
          {containerProps => (
            <SearchBar
              {...containerProps}
              query={search}
              onSearch={onChangeSearch}
              placeholder={t('Filter Integrations\u2026')}
              aria-label={t('Filter')}
              width="100%"
              data-test-id="search-bar"
            />
          )}
        </Container>
        <CreateIntegrationButton analyticsView="integrations_directory" size="md" />
      </Flex>
    </Fragment>
  );
}

function IntegrationResultsEmpty({searchTerm}: {searchTerm: string}) {
  return (
    <Stack justify="center" align="center" height="200px">
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
    </Stack>
  );
}

const EmptyResultsBody = styled('div')`
  font-size: 16px;
  line-height: 28px;
  color: ${p => p.theme.tokens.content.secondary};
  padding-bottom: ${p => p.theme.space.xl};
`;

const EmptyResultsBodyBold = styled(EmptyResultsBody)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
