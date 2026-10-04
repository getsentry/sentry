import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {
  conventionQueryOptions,
  getConventionSchedule,
} from 'sentry/views/codeConventions/utils';
import {crontabAsText} from 'sentry/views/insights/crons/utils/crontabAsText';

export function ScheduleText({schedule}: {schedule: string}) {
  return (
    <Stack gap="2xs">
      <Text>{crontabAsText(schedule) ?? t('Invalid schedule')}</Text>
      <Text size="xs" variant="muted" monospace>
        {schedule}
      </Text>
    </Stack>
  );
}

/**
 * Table cell reading the schedule from the convention's (cached) YAML.
 */
export function ConventionSchedule({filename}: {filename: string}) {
  const {data: convention, isPending} = useQuery(conventionQueryOptions(filename));

  if (isPending) {
    return <Placeholder width="80px" height="20px" />;
  }
  if (!convention) {
    return null;
  }
  return <ScheduleText schedule={getConventionSchedule(convention)} />;
}
