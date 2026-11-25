import {Input, type InputProps} from '@sentry/scraps/input';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {timezoneOptions} from 'sentry/data/timezones';
import {t} from 'sentry/locale';
import {crontabAsText} from 'sentry/views/insights/crons/utils/crontabAsText';
import type {SeerWorkflowCron} from 'sentry/views/seerWorkflows/types';

/**
 * Whether the schedule is a five field crontab expression that can be read
 */
export function isValidCrontab(crontab: string) {
  return (
    crontab.trim().split(/\s+/).length === 5 && crontabAsText(crontab.trim()) !== null
  );
}

interface ScheduleFieldProps {
  onChange: (value: SeerWorkflowCron) => void;
  value: SeerWorkflowCron;
  disabled?: boolean;
  /**
   * Props for the crontab input, e.g. the field's id and blur handler
   */
  inputProps?: Omit<InputProps, 'value' | 'onChange' | 'disabled'>;
}

/**
 * Picks a schedule as a crontab expression and its timezone.
 */
export function ScheduleField({
  value,
  onChange,
  disabled,
  inputProps,
}: ScheduleFieldProps) {
  const parsedSchedule = crontabAsText(value.crontab.trim());

  return (
    <Stack gap="md" width="100%">
      <Grid columns="minmax(0, 1fr) minmax(0, 1fr)" gap="md">
        <Input
          aria-label={t('Crontab Schedule')}
          monospace
          placeholder="* * * * *"
          {...inputProps}
          value={value.crontab}
          disabled={disabled}
          onChange={e =>
            // Keep only printable ASCII characters in the crontab schedule
            onChange({...value, crontab: e.target.value.replace(/[^ -~]/g, '')})
          }
        />
        <Select
          aria-label={t('Timezone')}
          value={value.timezone}
          options={timezoneOptions}
          disabled={disabled}
          onChange={option => onChange({...value, timezone: option.value})}
        />
      </Grid>
      {parsedSchedule && (
        <Text monospace size="xs" variant="muted">
          "{parsedSchedule}"
        </Text>
      )}
    </Stack>
  );
}
