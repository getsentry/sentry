import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {GcpVerificationResults} from 'sentry/components/gcpVerificationResults';
import {TimeSince} from 'sentry/components/timeSince';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  buildGcpVerifyPayload,
  getGcpProjectResults,
} from 'sentry/utils/seer/gcpConnection';

interface GcpConnectionStatusProps {
  configData: OrganizationIntegration['configData'];
  onRetested: () => void | Promise<void>;
  organization: Organization;
  isVerifying?: boolean;
  onVerificationStarted?: () => void;
  verificationError?: boolean;
}

export function GcpConnectionStatus({
  configData,
  isVerifying = false,
  onRetested,
  organization,
  verificationError = false,
  onVerificationStarted,
}: GcpConnectionStatusProps) {
  const status =
    typeof configData?.connection_status === 'string'
      ? configData.connection_status
      : 'unverified';
  const lastVerifiedAt = configData?.last_verified_at;
  const projects = getGcpProjectResults(configData?.project_statuses ?? []);

  const payload = buildGcpVerifyPayload(configData);

  const {
    mutate: retest,
    isPending: isRetesting,
    isError,
    reset,
  } = useMutation({
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
    onMutate: () => onVerificationStarted?.(),
    onError: () => onRetested(),
  });

  useEffect(() => {
    if (isVerifying) {
      reset();
    }
  }, [isVerifying, reset]);

  const isPending = isRetesting || isVerifying;
  const hasRequestError = !isPending && (isError || verificationError);

  return (
    <FieldGroup title={t('Connection Status')}>
      <Stack gap="md" padding="xl">
        {hasRequestError && (
          <Alert variant="warning" role="alert">
            {t("The connection check couldn't be completed. Try again.")}
          </Alert>
        )}
        <Stack gap="sm" role="status" aria-live="polite">
          {isPending ? (
            <Flex gap="sm" align="center">
              <StatusIndicator variant="muted" />
              <Text bold>{t('Checking connection...')}</Text>
            </Flex>
          ) : (
            <Stack gap="sm">
              {hasRequestError && typeof lastVerifiedAt === 'string' && (
                <Text size="sm" variant="muted">
                  {t('Previous verification result')}
                </Text>
              )}
              {projects === null ? (
                <Alert variant="warning">
                  {t(
                    "Saved connection results couldn't be loaded. Re-test the connection."
                  )}
                </Alert>
              ) : (
                <GcpVerificationResults result={{connectionStatus: status, projects}} />
              )}
            </Stack>
          )}
        </Stack>

        <Flex gap="md" align="center" justify="between" wrap="wrap">
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
