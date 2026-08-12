import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';

import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {IntegrationProvider} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {BreadcrumbDropdown} from './breadcrumbDropdown';
import type {SettingsBreadcrumbProps} from './types';
import {CrumbLink} from '.';

type IntegrationProviderResponse = {
  providers: IntegrationProvider[];
};

export function IntegrationCrumb({
  route,
  routes: _routes,
  isLast: _isLast,
  ...props
}: SettingsBreadcrumbProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const params = useParams();
  const activeProviderKey = params.integrationSlug ?? params.providerKey;
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
  const activeProviderName = activeProvider?.name ?? activeProviderKey;
  const configuredItemSelected = Boolean(params.integrationId);
  const activeProviderUrl = `/settings/${organization.slug}/integrations/${activeProviderKey}/`;
  const activeProviderHref = configuredItemSelected
    ? activeProviderUrl
    : `${activeProviderUrl}${location.search}`;

  return (
    <BreadcrumbDropdown
      name={
        <CrumbLink to={activeProviderHref}>
          <Flex align="center" gap="xs">
            <PluginIcon pluginId={activeProviderKey} size={18} />
            {activeProviderName}
          </Flex>
        </CrumbLink>
      }
      onCrumbSelect={providerKey => {
        const {tab: _tab, ...queryWithoutTab} = location.query;
        const query = configuredItemSelected ? queryWithoutTab : location.query;
        navigate({
          pathname: `/settings/${organization.slug}/integrations/${providerKey}/`,
          query,
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
      {...props}
      isLast={false}
    />
  );
}
