import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {openConfirmModal} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {Redirect} from 'sentry/components/redirect';
import {DatadogPatConnectModal} from 'sentry/components/seer/datadogPatConnectModal';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {monitoringProvidersSettingsPath} from 'sentry/utils/seer/monitoringProvidersSettingsPath';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {ConnectorRow} from 'getsentry/views/seerAutomation/components/connectorRow';

export type MonitoringProvider = {
  connected: boolean;
  name: string;
  provider: string;
};

type MonitoringProvidersResponse = {
  providers: MonitoringProvider[];
};

const PAT_PROVIDERS = new Set(['datadog_pat']);

function monitoringProvidersQueryOptions(orgSlug: string) {
  return apiOptions.as<MonitoringProvidersResponse>()(
    '/organizations/$organizationIdOrSlug/monitoring-providers/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: 30_000,
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
  const queryClient = useQueryClient();

  const {data, isPending, isError, refetch} = useQuery(
    monitoringProvidersQueryOptions(organization.slug)
  );

  const connectMutation = useMutation({
    mutationFn: (params: {provider: string; site?: string}) =>
      fetchMutation<{redirectUrl: string}>({
        method: 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/$providerKey/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              providerKey: params.provider,
            },
          }
        ),
        data: {
          return_url: monitoringProvidersSettingsPath(organization),
          ...(params.site ? {site: params.site} : {}),
        },
      }),
    onSuccess: responseData => {
      testableWindowLocation.assign(responseData.redirectUrl);
    },
    onError: () => {
      addErrorMessage(t('Failed to start connection.'));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: string) =>
      fetchMutation({
        method: 'DELETE',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/$providerKey/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              providerKey: provider,
            },
          }
        ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: monitoringProvidersQueryOptions(organization.slug).queryKey,
      });
      addSuccessMessage(t('Provider disconnected.'));
    },
    onError: () => {
      addErrorMessage(t('Failed to disconnect provider.'));
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: (provider: string) =>
      fetchMutation<{redirectUrl: string}>({
        method: 'PUT',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/$providerKey/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              providerKey: provider,
            },
          }
        ),
        data: {return_url: monitoringProvidersSettingsPath(organization)},
      }),
    onSuccess: responseData => {
      testableWindowLocation.assign(responseData.redirectUrl);
    },
    onError: () => {
      addErrorMessage(t('Failed to start reconnection.'));
    },
  });

  function handleConnect(provider: MonitoringProvider) {
    if (PAT_PROVIDERS.has(provider.provider)) {
      openModal(modalProps => (
        <DatadogPatConnectModal
          {...modalProps}
          orgSlug={organization.slug}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: monitoringProvidersQueryOptions(organization.slug).queryKey,
            });
            addSuccessMessage(t('Provider connected.'));
          }}
        />
      ));
      return;
    }

    const params: {provider: string; site?: string} = {provider: provider.provider};
    if (provider.provider === 'datadog') {
      // TODO(CW-1501): v0 only supports datadoghq.com; add site selection when per-site connections are supported
      params.site = 'datadoghq.com';
    }
    connectMutation.mutate(params);
  }

  function handleReconnect(provider: MonitoringProvider) {
    if (PAT_PROVIDERS.has(provider.provider)) {
      openModal(modalProps => (
        <DatadogPatConnectModal
          {...modalProps}
          orgSlug={organization.slug}
          isReauth
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: monitoringProvidersQueryOptions(organization.slug).queryKey,
            });
            addSuccessMessage(t('Provider reconnected.'));
          }}
        />
      ));
      return;
    }

    reconnectMutation.mutate(provider.provider);
  }

  function handleDisconnect(provider: MonitoringProvider) {
    openConfirmModal({
      message: t('Are you sure you want to disconnect %s?', provider.name),
      onConfirm: () => disconnectMutation.mutate(provider.provider),
    });
  }

  const providers = data?.providers ?? [];

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
            {providers.map(provider => (
              <ConnectorRow
                key={provider.provider}
                provider={provider}
                onConnect={handleConnect}
                onReconnect={handleReconnect}
                onDisconnect={handleDisconnect}
                isConnecting={
                  connectMutation.isPending &&
                  connectMutation.variables.provider === provider.provider
                }
                isReconnecting={
                  reconnectMutation.isPending &&
                  reconnectMutation.variables === provider.provider
                }
                isDisconnecting={
                  disconnectMutation.isPending &&
                  disconnectMutation.variables === provider.provider
                }
              />
            ))}
          </Panel>
        )}
      </Stack>
    </SentryDocumentTitle>
  );
}
