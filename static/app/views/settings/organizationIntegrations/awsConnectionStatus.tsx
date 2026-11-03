import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AwsVerificationResults} from 'sentry/components/awsVerificationResults';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getStoredAwsVerification} from 'sentry/utils/seer/awsConnection';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AwsConnectionStatus({
  integration,
  onRetested,
}: {
  integration: OrganizationIntegration;
  onRetested: () => Promise<void>;
}) {
  const organization = useOrganization();
  const result = getStoredAwsVerification(integration.configData?.verification);
  const lastVerifiedAt = integration.configData?.last_verified_at;
  const {mutate, isPending, isError} = useMutation({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
          {path: {organizationIdOrSlug: organization.slug, integrationId: integration.id}}
        ),
        data: {},
      }),
    onSuccess: onRetested,
  });
  return (
    <FieldGroup title={t('Connection Status')}>
      <Stack gap="md" padding="xl">
        {isError && (
          <Alert variant="warning">
            {t('The connection check could not be completed. Try again.')}
          </Alert>
        )}
        <Stack role="status" aria-live="polite">
          {isPending ? (
            <Text>{t('Checking connection...')}</Text>
          ) : result ? (
            <AwsVerificationResults result={result} />
          ) : (
            <Text>{t('Re-test the connection to verify AWS access.')}</Text>
          )}
        </Stack>
        <Flex gap="md" align="center" justify="between">
          <Text variant="muted" size="sm">
            {typeof lastVerifiedAt === 'string'
              ? tct('Last checked [when]', {when: <TimeSince date={lastVerifiedAt} />})
              : t('Never checked')}
          </Text>
          <Button
            size="sm"
            busy={isPending}
            disabled={isPending}
            onClick={() => mutate()}
          >
            {t('Re-test')}
          </Button>
        </Flex>
      </Stack>
    </FieldGroup>
  );
}
