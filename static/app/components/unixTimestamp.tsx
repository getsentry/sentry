import {RELATIVE_TIME_MAX_WIDTH, RelativeTime} from '@sentry/scraps/relativeTime';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

interface UnixTimestampProps {
  value: unknown;
  fallback?: React.ReactNode;
  label?: React.ReactNode;
}

/**
 * Renders Unix timestamp with a hover card that makes it human-readable
 */
export function UnixTimestamp({
  value,
  fallback = null,
  label = t('Timestamp'),
}: UnixTimestampProps): React.ReactNode {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return fallback;
  }

  return (
    <Tooltip
      maxWidth={RELATIVE_TIME_MAX_WIDTH}
      title={<RelativeTime date={seconds * 1000} label={label} showSeconds />}
    >
      <span>{String(value)}</span>
    </Tooltip>
  );
}
