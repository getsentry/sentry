import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {DatadogPatConnectModal} from 'sentry/components/seer/datadogPatConnectModal';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {monitoringProvidersSettingsPath} from 'sentry/utils/seer/monitoringProvidersSettingsPath';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ReauthMonitoringProviderData} from 'sentry/views/seerExplorer/types';

const PROVIDER_LABELS: Record<string, string> = {
  datadog: 'Datadog',
  datadog_pat: 'Datadog',
  gcp: 'Google Cloud Platform',
};

interface ReauthMonitoringProviderBlockProps {
  data: ReauthMonitoringProviderData;
  onComplete: () => void;
  /** Where to send the user back after the OAuth round-trip. */
  returnUrl?: string;
}

export function ReauthMonitoringProviderBlock({
  data,
  onComplete,
  returnUrl,
}: ReauthMonitoringProviderBlockProps) {
  const organization = useOrganization();
  const isPat = data.auth_method === 'pat';
  const providerLabel = PROVIDER_LABELS[data.provider_key] ?? data.provider_key;

  const connectOAuthMutation = useMutation({
    mutationFn: () =>
      fetchMutation<{redirectUrl: string}>({
        method: 'PUT',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/$providerKey/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              providerKey: data.provider_key,
            },
          }
        ),
        data: {
          return_url: returnUrl ?? monitoringProvidersSettingsPath(organization),
        },
      }),
    onSuccess: responseData => {
      testableWindowLocation.assign(responseData.redirectUrl);
    },
    onError: () => {
      addErrorMessage(t('Failed to start reconnection.'));
    },
  });

  function handleReconnect() {
    // PAT providers reconnect in-place, so we can resume the run immediately on success.
    if (isPat) {
      openModal(modalProps => (
        <DatadogPatConnectModal
          {...modalProps}
          orgSlug={organization.slug}
          isReauth
          onSuccess={() => {
            addSuccessMessage(t('Provider reconnected.'));
            onComplete();
          }}
        />
      ));
      return;
    }

    connectOAuthMutation.mutate();
  }

  return (
    <Container padding="xl">
      <Container padding="xl" border="primary" radius="md">
        <Stack gap="lg">
          <Text>
            {t('Your %s connection has expired. Reconnect to continue.', providerLabel)}
          </Text>
          <Flex gap="sm" align="center">
            <Button
              variant="primary"
              size="sm"
              onClick={handleReconnect}
              busy={connectOAuthMutation.isPending}
            >
              {t('Reconnect')}
            </Button>
          </Flex>
        </Stack>
      </Container>
    </Container>
  );
}
