import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {getNextCheckInEnv} from 'sentry/views/alerts/rules/crons/utils';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

export function CronMonitor({detector}: {detector: CronDetector}) {
  const monitor = detector.dataSources[0].queryObj;
  const environment = getNextCheckInEnv(monitor.environments);

  return (
    <Stack gap="sm">
      <Heading as="h4" size="xs">
        {t('Monitor configuration')}
      </Heading>
      <Grid columns="max-content minmax(0, 1fr)" gap="sm md">
        <Text variant="muted">{t('Schedule')}</Text>
        <Text>{scheduleAsText(monitor.config)}</Text>
        <Text variant="muted">{t('Monitor slug')}</Text>
        <Text monospace ellipsis>
          {monitor.slug}
        </Text>
        <Text variant="muted">{t('Last check-in')}</Text>
        <Text>
          {environment?.lastCheckIn ? (
            <TimeSince date={environment.lastCheckIn} />
          ) : (
            t('No check-ins')
          )}
        </Text>
        <Text variant="muted">{t('Next check-in')}</Text>
        <Text>
          {environment?.nextCheckIn ? (
            <TimeSince date={environment.nextCheckIn} />
          ) : (
            t('Not scheduled')
          )}
        </Text>
      </Grid>
    </Stack>
  );
}
