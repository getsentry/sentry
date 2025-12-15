import moment from 'moment-timezone';

import {getTimeFormat} from 'sentry/utils/dates';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface FormatXAxisTimestampOptions {
  durationMs?: number;
  timezone?: string;
}

export function formatXAxisTimestamp(
  value: number,
  options: FormatXAxisTimestampOptions = {}
): string {
  const timezone = options.timezone ?? 'UTC';
  const duration = options.durationMs ?? DAY_MS;
  const parsed = moment(value).tz(timezone);

  if (duration > DAY_MS) {
    if (parsed.dayOfYear() === 1 && parsed.hour() === 0 && parsed.minute() === 0) {
      return parsed.format('MMM Do YYYY');
    }
    return parsed.format('MMM Do');
  }

  return parsed.format(getTimeFormat());
}

const NICE_INTERVALS = [
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  4 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  DAY_MS,
  2 * DAY_MS,
  7 * DAY_MS,
];

export interface XAxisConfig {
  interval: number;
  labelInterval: number;
}

export function computeXAxisConfig(
  start: number | undefined,
  end: number | undefined,
  _timezone: string,
  targetTickCount = 5
): XAxisConfig | undefined {
  if (start === undefined || end === undefined) {
    return undefined;
  }

  const duration = end - start;
  const targetInterval = duration / targetTickCount;

  let interval = NICE_INTERVALS[0]!;
  for (const candidate of NICE_INTERVALS) {
    if (candidate <= targetInterval) {
      interval = candidate;
    } else {
      break;
    }
  }

  const totalTicks = Math.ceil(duration / interval);
  let labelInterval = 0;
  if (totalTicks > targetTickCount * 2) {
    const skip = Math.ceil(totalTicks / targetTickCount);
    labelInterval = [2, 3, 4, 5, 6].find(f => f >= skip) ?? skip;
    labelInterval -= 1;
  }

  return {interval, labelInterval};
}
