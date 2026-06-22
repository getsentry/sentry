import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

type MonitoringProvider = {
  connected: boolean;
  name: string;
  provider: string;
};

type MonitoringProvidersResponse = {
  providers: MonitoringProvider[];
};

function monitoringProvidersQueryOptions(orgSlug: string) {
  return apiOptions.as<MonitoringProvidersResponse>()(
    '/organizations/$organizationIdOrSlug/monitoring-providers/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: 30_000,
    }
  );
}

export function MonitoringProvidersSection() {
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
        data: params.site ? {site: params.site} : undefined,
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

  function handleConnect(provider: MonitoringProvider) {
    const params: {provider: string; site?: string} = {provider: provider.provider};
    if (provider.provider === 'datadog') {
      // TODO(CW-1501): v0 only supports datadoghq.com; add site selection when per-site connections are supported
      params.site = 'datadoghq.com';
    }
    connectMutation.mutate(params);
  }

  function handleDisconnect(provider: MonitoringProvider) {
    openConfirmModal({
      message: t('Are you sure you want to disconnect %s?', provider.name),
      onConfirm: () => disconnectMutation.mutate(provider.provider),
    });
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const providers = data?.providers ?? [];

  return (
    <Container padding="xl" border="primary" radius="md">
      <Flex direction="column" gap="lg">
        <Heading as="h3">{t('Monitoring Providers')}</Heading>
        <Text variant="muted" size="lg">
          {t(
            'Connect your monitoring providers to let Seer access infrastructure telemetry when investigating issues.'
          )}
        </Text>
        {providers.map(provider => (
          <Flex key={provider.provider} align="center" justify="between">
            <Flex direction="column" gap="xs">
              <Text size="lg">{provider.name}</Text>
              <Text variant="muted">
                {provider.connected ? t('Connected') : t('Not connected')}
              </Text>
            </Flex>
            {provider.connected ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDisconnect(provider)}
                busy={
                  disconnectMutation.isPending &&
                  disconnectMutation.variables === provider.provider
                }
              >
                {t('Disconnect')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleConnect(provider)}
                busy={
                  connectMutation.isPending &&
                  connectMutation.variables.provider === provider.provider
                }
              >
                {t('Connect')}
              </Button>
            )}
          </Flex>
        ))}
      </Flex>
    </Container>
  );
}
