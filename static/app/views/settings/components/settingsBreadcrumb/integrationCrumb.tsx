import {skipToken, useQuery} from '@tanstack/react-query';

import {SentryAppAvatar} from '@sentry/scraps/avatar';

import {sentryAppApiOptions} from 'sentry/actionCreators/sentryApps';
import {Placeholder} from 'sentry/components/placeholder';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {IntegrationIcon} from 'sentry/views/settings/organizationIntegrations/integrationIcon';

import {SettingsBreadcrumbSelector} from './settingsBreadcrumbSelector';
import type {SettingsBreadcrumbSelectorProps} from './types';

type IntegrationProviderResponse = {
  providers: IntegrationProvider[];
};

export function IntegrationCrumb({
  to,
  switchTo,
  children,
  isSentryAppRoute = false,
}: SettingsBreadcrumbSelectorProps & {isSentryAppRoute?: boolean}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const params = useParams();
  const activeProviderKey = params.integrationSlug ?? params.providerKey;
  const {data: sentryApp, isPending: isSentryAppPending} = useQuery(
    sentryAppApiOptions({
      appSlug: isSentryAppRoute ? (activeProviderKey ?? null) : null,
    })
  );
  const {data: integration, isPending: isIntegrationPending} = useQuery(
    apiOptions.as<Integration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: params.integrationId
          ? {
              organizationIdOrSlug: organization.slug,
              integrationId: params.integrationId,
            }
          : skipToken,
        staleTime: 0,
      }
    )
  );
  const {data, isPending} = useQuery(
    apiOptions.as<IntegrationProviderResponse>()(
      '/organizations/$organizationIdOrSlug/config/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: Infinity,
      }
    )
  );

  if (!activeProviderKey) {
    return children;
  }

  const providers = data?.providers ?? [];
  const activeProvider = providers.find(
    provider => provider.key === activeProviderKey || provider.slug === activeProviderKey
  );
  const activeProviderName = activeProvider?.name ?? sentryApp?.name ?? activeProviderKey;
  const configuredItemSelected = Boolean(params.integrationId);
  const isIconPending =
    (isSentryAppRoute && isSentryAppPending) ||
    (configuredItemSelected && isIntegrationPending);
  const activeProviderUrl = replaceRouterParams(to, params);
  const activeProviderHref = configuredItemSelected
    ? activeProviderUrl
    : `${activeProviderUrl}${location.search}`;

  return (
    <SettingsBreadcrumbSelector
      label={activeProviderName}
      leadingGraphic={
        isIconPending ? (
          <Placeholder width="16px" height="16px" />
        ) : sentryApp ? (
          <SentryAppAvatar sentryApp={sentryApp} size={16} />
        ) : integration ? (
          <IntegrationIcon integration={integration} size={16} />
        ) : (
          <PluginIcon pluginId={activeProviderKey} size={16} />
        )
      }
      to={activeProviderHref}
      onCrumbSelect={providerKey => {
        const {tab: _tab, ...queryWithoutTab} = location.query;
        navigate({
          pathname: normalizeUrl(
            replaceRouterParams(switchTo, {
              ...params,
              providerKey,
              integrationSlug: providerKey,
            })
          ),
          query: queryWithoutTab,
        });
      }}
      onOpenChange={open => {
        if (open) {
          trackAnalytics('breadcrumbs.menu.opened', {organization: null});
        }
      }}
      hasMenu={providers.length > 1}
      value={activeProvider?.key ?? activeProviderKey}
      search={{placeholder: t('Search Integrations')}}
      options={providers.map(provider => ({
        value: provider.key,
        leadingItems: <PluginIcon pluginId={provider.key} size={16} />,
        label: provider.name,
      }))}
      loading={isPending}
    >
      {children}
    </SettingsBreadcrumbSelector>
  );
}
