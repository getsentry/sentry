import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {getDuration} from 'sentry/utils/duration/getDuration';

export function UptimeMonitor({detector}: {detector: UptimeDetector}) {
  const {queryObj} = detector.dataSources[0];

  return (
    <Stack gap="sm">
      <Heading as="h4" size="xs">
        {t('Monitor configuration')}
      </Heading>
      <Text monospace wordBreak="break-all">
        {queryObj.method} {queryObj.url}
      </Text>
      <Grid columns="max-content minmax(0, 1fr)" gap="sm md">
        <Text variant="muted">{t('Interval')}</Text>
        <Text>{t('Every %s', getDuration(queryObj.intervalSeconds))}</Text>
        <Text variant="muted">{t('Timeout')}</Text>
        <Text>{t('After %s', getDuration(queryObj.timeoutMs / 1000, 2))}</Text>
        <Text variant="muted">{t('Creates an issue')}</Text>
        <Text>
          {tn(
            'After one failed check',
            'After %s consecutive failed checks',
            detector.config.downtimeThreshold
          )}
        </Text>
        <Text variant="muted">{t('Resolves')}</Text>
        <Text>
          {tn(
            'After one successful check',
            'After %s consecutive successful checks',
            detector.config.recoveryThreshold
          )}
        </Text>
      </Grid>
    </Stack>
  );
}
