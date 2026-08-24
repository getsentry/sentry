import {skipToken, useQuery} from '@tanstack/react-query';

import {SentryAppAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';

import {sentryAppApiOptions} from 'sentry/actionCreators/sentryApps';
import {Placeholder} from 'sentry/components/placeholder';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {IntegrationIcon} from 'sentry/views/settings/organizationIntegrations/integrationIcon';

import {BreadcrumbDropdown} from './breadcrumbDropdown';
import type {RouteWithName, SettingsBreadcrumbProps} from './types';
import {CrumbLink} from '.';

type IntegrationProviderResponse = {
  providers: IntegrationProvider[];
};

export function IntegrationCrumb({route, routes}: SettingsBreadcrumbProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const params = useParams();
  const activeProviderKey = params.integrationSlug ?? params.providerKey;
  const isSentryAppRoute = routes.some(
    (item: RouteWithName) => item.path === 'sentry-apps/'
  );
  const hasFollowingTopBarTitle = routes.some(
    (item: RouteWithName) => item.path === 'integrations/'
  );
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
    return null;
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
  const activeProviderUrl = `/settings/${organization.slug}/${isSentryAppRoute ? 'sentry-apps' : 'integrations'}/${activeProviderKey}/`;
  const activeProviderHref = configuredItemSelected
    ? activeProviderUrl
    : `${activeProviderUrl}${location.search}`;

  return (
    <BreadcrumbDropdown
      name={
        <CrumbLink to={activeProviderHref}>
          <Flex align="center" gap="xs">
            {isIconPending ? (
              <Placeholder width="18px" height="18px" />
            ) : sentryApp ? (
              <SentryAppAvatar sentryApp={sentryApp} size={18} />
            ) : integration ? (
              <IntegrationIcon integration={integration} size={18} />
            ) : (
              <PluginIcon pluginId={activeProviderKey} size={18} />
            )}
            {isSentryAppRoute && isSentryAppPending ? (
              <Placeholder width="64px" height="16px" />
            ) : (
              activeProviderName
            )}
          </Flex>
        </CrumbLink>
      }
      onCrumbSelect={providerKey => {
        const {tab: _tab, ...queryWithoutTab} = location.query;
        navigate({
          pathname: `/settings/${organization.slug}/integrations/${providerKey}/`,
          query: queryWithoutTab,
        });
      }}
      onOpenChange={open => {
        if (open) {
          trackAnalytics('breadcrumbs.menu.opened', {organization: null});
        }
      }}
      hasMenu={providers.length > 1}
      route={route}
      value={activeProvider?.key ?? activeProviderKey}
      search={{placeholder: t('Search Integrations')}}
      options={providers.map(provider => ({
        value: provider.key,
        leadingItems: <PluginIcon pluginId={provider.key} size={16} />,
        label: provider.name,
      }))}
      loading={isPending}
      showDivider={hasFollowingTopBarTitle}
    />
  );
}
