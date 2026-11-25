import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {Input, type InputProps} from '@sentry/scraps/input';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {timezoneOptions} from 'sentry/data/timezones';
import {t} from 'sentry/locale';
import {crontabAsText} from 'sentry/views/insights/crons/utils/crontabAsText';
import type {WorkflowCronSchedule} from 'sentry/views/seerWorkflows/types';

/**
 * Whether the schedule is a five field crontab expression that can be read
 */
export function isValidCrontab(crontab: string) {
  return (
    crontab.trim().split(/\s+/).length === 5 && crontabAsText(crontab.trim()) !== null
  );
}

interface ScheduleFieldProps {
  onChange: (value: WorkflowCronSchedule) => void;
  /**
   * Removes this schedule from the automation
   */
  onRemove: () => void;
  value: WorkflowCronSchedule;
  /**
   * Whether this schedule can be removed
   */
  canRemove?: boolean;
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
  onRemove,
  canRemove,
  disabled,
  inputProps,
}: ScheduleFieldProps) {
  // Only describe schedules that can be saved, e.g. not aliases like @daily
  const parsedSchedule = isValidCrontab(value.crontab)
    ? crontabAsText(value.crontab.trim())
    : null;

  return (
    <Stack gap="md" width="100%">
      <Grid columns="minmax(0, 1fr) minmax(0, 1fr) max-content" gap="md">
        <Input
          aria-label={t('Crontab Schedule')}
          monospace
          placeholder="* * * * *"
          {...inputProps}
          value={value.crontab}
          disabled={disabled}
          onChange={e =>
            // Separate fields with spaces, e.g. for pasted tabs, and keep only
            // printable ASCII characters
            onChange({
              ...value,
              crontab: e.target.value.replace(/\s/g, ' ').replace(/[^ -~]/g, ''),
            })
          }
        />
        <Select
          aria-label={t('Timezone')}
          value={value.timezone}
          options={timezoneOptions}
          disabled={disabled}
          onChange={option => onChange({...value, timezone: option.value})}
        />
        <Button
          aria-label={t('Remove schedule')}
          icon={<IconClose />}
          disabled={disabled || !canRemove}
          onClick={onRemove}
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
