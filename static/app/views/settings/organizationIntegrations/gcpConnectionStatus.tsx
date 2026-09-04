import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  buildGcpVerifyPayload,
  getConnectionErrorDetails,
  getStatusLabel,
  getStatusVariant,
} from 'sentry/utils/seer/gcpConnection';

interface GcpConnectionStatusProps {
  configData: OrganizationIntegration['configData'];
  onRetested: () => void | Promise<void>;
  organization: Organization;
  isVerifying?: boolean;
}

export function GcpConnectionStatus({
  configData,
  isVerifying = false,
  onRetested,
  organization,
}: GcpConnectionStatusProps) {
  const status =
    typeof configData?.connection_status === 'string'
      ? configData.connection_status
      : 'unverified';
  const lastVerifiedAt = configData?.last_verified_at;
  const isConnected = status === 'connected';
  const errorDetails = isConnected
    ? []
    : getConnectionErrorDetails(configData?.project_statuses);

  const payload = buildGcpVerifyPayload(configData);

  const {mutate: retest, isPending: isRetesting} = useMutation({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/gcp/verify-connection/',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
        data: payload ?? undefined,
      }),
    onSuccess: () => onRetested(),
    onError: () => onRetested(),
  });

  const isPending = isRetesting || isVerifying;
  const shownErrorDetails = isPending ? [] : errorDetails;

  return (
    <FieldGroup title={t('Connection Status')}>
      <Stack gap="md" padding="xl">
        <Flex gap="sm" align="center">
          {isPending ? (
            <StatusIndicator variant="muted" />
          ) : (
            <StatusIndicator
              variant={getStatusVariant(status)}
              animationIterationCount={1}
            />
          )}
          <Text bold>
            {isPending ? t('Checking connection...') : getStatusLabel(status)}
          </Text>
        </Flex>

        {shownErrorDetails.map(detail => (
          <Text key={detail} variant="muted" size="sm">
            {detail}
          </Text>
        ))}

        <Flex gap="md" align="center" justify="between">
          <Text variant="muted" size="sm">
            {isPending
              ? null
              : typeof lastVerifiedAt === 'string'
                ? tct('Last checked [when]', {when: <TimeSince date={lastVerifiedAt} />})
                : t('Never checked')}
          </Text>
          <Button
            size="sm"
            icon={<IconRefresh size="xs" />}
            onClick={() => retest()}
            busy={isPending}
            disabled={isPending || !payload}
          >
            {t('Re-test')}
          </Button>
        </Flex>
      </Stack>
    </FieldGroup>
  );
}
