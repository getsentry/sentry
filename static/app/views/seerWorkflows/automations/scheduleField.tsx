import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {Input, type InputProps} from '@sentry/scraps/input';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {crontabAsText} from 'sentry/views/insights/crons/utils/crontabAsText';

/**
 * Whether the schedule is a five field crontab expression that can be read
 */
export function isValidCrontab(crontab: string) {
  return (
    crontab.trim().split(/\s+/).length === 5 && crontabAsText(crontab.trim()) !== null
  );
}

/**
 * Whether two or more crontabs are the same expression, ignoring spacing
 */
export function hasDuplicateCrontabs(crontabs: string[]) {
  const unique = new Set(crontabs.map(crontab => crontab.trim().split(/\s+/).join(' ')));
  return unique.size < crontabs.length;
}

interface ScheduleFieldProps {
  onChange: (crontab: string) => void;
  /**
   * Removes this schedule from the automation
   */
  onRemove: () => void;
  /**
   * The schedule as a crontab expression
   */
  value: string;
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
 * Picks a schedule as a crontab expression.
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
  const parsedSchedule = isValidCrontab(value) ? crontabAsText(value.trim()) : null;

  return (
    <Stack gap="md" width="100%">
      <Grid columns="minmax(0, 1fr) max-content" gap="md">
        <Input
          aria-label={t('Crontab Schedule')}
          monospace
          placeholder="* * * * *"
          {...inputProps}
          value={value}
          disabled={disabled}
          onChange={e =>
            // Separate fields with spaces, e.g. for pasted tabs, and keep only
            // printable ASCII characters
            onChange(e.target.value.replace(/\s/g, ' ').replace(/[^ -~]/g, ''))
          }
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
