import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {AwsVerificationResult} from 'sentry/utils/seer/awsConnection';

export function AwsVerificationResults({result}: {result: AwsVerificationResult}) {
  return (
    <Stack gap="md">
      {!result.externalIdRequired && (
        <Alert variant="danger">
          {t(
            'Sentry could not verify that this role requires your external ID. Check the trust policy and re-test before connecting.'
          )}
        </Alert>
      )}
      {result.errorDetail && <Alert variant="warning">{result.errorDetail}</Alert>}
      {result.regions.map(region => (
        <Stack key={region.region} gap="sm">
          <Flex gap="sm" align="center">
            <Text bold>{region.region}</Text>
            <Tag
              variant={region.connectionStatus === 'connected' ? 'success' : 'warning'}
            >
              {region.connectionStatus === 'connected'
                ? t('Connected')
                : t('Verification failed')}
            </Tag>
          </Flex>
          {region.errorDetail && <Text variant="danger">{region.errorDetail}</Text>}
          {region.services.map(service => (
            <Text key={service.service} size="sm">
              {service.service}:{' '}
              {service.status === 'connected' ? t('Connected') : t('Verification failed')}
              {service.errorDetail ? ` — ${service.errorDetail}` : ''}
            </Text>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
