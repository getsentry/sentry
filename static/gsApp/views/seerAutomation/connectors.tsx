import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getProviderIntegrationStatus} from 'sentry/utils/integrationUtil';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {IntegrationRow} from 'sentry/views/settings/organizationIntegrations/integrationRow';

// The IntegrationFeatures.SEER_CONTEXT marker. Providers carrying it expose
// telemetry Seer can read; the connectors page lists exactly those.
const SEER_CONTEXT_FEATURE = 'seer-context';

// Cheap query to get all providers available to the org, plus their integration features.
function configIntegrationsQueryOptions(orgSlug: string) {
  return apiOptions.as<{providers: IntegrationProvider[]}>()(
    '/organizations/$organizationIdOrSlug/config/integrations/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: 0,
    }
  );
}

// Get the installation status for all IntegrationFeatures.SEER_CONTEXT providers.
function integrationsQueryOptions(orgSlug: string) {
  return apiOptions.as<Integration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: orgSlug},
      // Config serialization is O(n) per integration, so if we want to includeConfig,
      // filtering by seer_context becomes important.
      query: {features: 'seer_context', includeConfig: 0},
      staleTime: 0,
    }
  );
}

export default function SeerConnectors() {
  const organization = useOrganization();

  if (!organization.features.includes('seer-infra-telemetry')) {
    return <Redirect to={normalizeUrl(`/settings/${organization.slug}/seer/`)} />;
  }

  return <SeerConnectorsContent />;
}

function SeerConnectorsContent() {
  const organization = useOrganization();

  const configQuery = useQuery(configIntegrationsQueryOptions(organization.slug));
  const integrationsQuery = useQuery(integrationsQueryOptions(organization.slug));

  const isPending = configQuery.isPending || integrationsQuery.isPending;
  const isError = configQuery.isError || integrationsQuery.isError;
  const refetch = () => {
    configQuery.refetch();
    integrationsQuery.refetch();
  };

  const providers = (configQuery.data?.providers ?? []).filter(provider =>
    provider.features.includes(SEER_CONTEXT_FEATURE)
  );
  const integrations = integrationsQuery.data ?? [];

  return (
    <SentryDocumentTitle title={t('Connectors')}>
      <SettingsPageHeader
        title={t('Connectors')}
        subtitle={t(
          'Connect external monitoring tools to let Seer access infrastructure telemetry when investigating issues.'
        )}
      />
      <Stack gap="lg">
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError onRetry={refetch} />
        ) : (
          <Panel>
            {providers.length === 0 ? (
              <PanelItem>
                {t('No monitoring connectors are available for this organization.')}
              </PanelItem>
            ) : (
              providers.map(provider => {
                const providerIntegrations = integrations.filter(
                  integration => integration.provider.key === provider.key
                );
                return (
                  <IntegrationRow
                    key={provider.slug}
                    organization={organization}
                    type="firstParty"
                    slug={provider.slug}
                    displayName={provider.name}
                    status={getProviderIntegrationStatus(providerIntegrations)}
                    publishStatus="published"
                    configurations={providerIntegrations.length}
                    categories={[]}
                  />
                );
              })
            )}
          </Panel>
        )}
      </Stack>
    </SentryDocumentTitle>
  );
}
