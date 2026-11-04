import {pgettext, t, tn} from '@sentry/scraps/translation';

export interface DurationOptions {
  absolute?: boolean;
  /** Smallest unit in milliseconds. Defaults to one millisecond. */
  minimumUnit?: number;
  precision?: number;
  style?: 'regular' | 'short' | 'narrow';
}

// Resolve translations when formatting, so changing the locale does not leave
// previously cached labels in another language.
const units = [
  {
    size: 31536000000,
    regular: (count: number) => tn('year', 'years', count),
    short: () => t('yr'),
    narrow: () => t('y'),
  },
  {
    size: 2629800000,
    regular: (count: number) => tn('month', 'months', count),
    short: () => t('mo'),
    narrow: () => pgettext('abbreviated months', 'm'),
  },
  {
    size: 604800000,
    regular: (count: number) => tn('week', 'weeks', count),
    short: () => t('wk'),
    narrow: () => t('w'),
  },
  {
    size: 86400000,
    regular: (count: number) => tn('day', 'days', count),
    short: () => t('d'),
    narrow: () => t('d'),
  },
  {
    size: 3600000,
    regular: (count: number) => tn('hour', 'hours', count),
    short: () => t('hr'),
    narrow: () => t('h'),
  },
  {
    size: 60000,
    regular: (count: number) => tn('minute', 'minutes', count),
    short: () => t('min'),
    narrow: () => pgettext('abbreviated minutes', 'm'),
  },
  {
    size: 1000,
    regular: (count: number) => tn('second', 'seconds', count),
    short: () => t('s'),
    narrow: () => t('s'),
  },
  {
    size: 1,
    regular: (count: number) => tn('millisecond', 'milliseconds', count),
    short: () => t('ms'),
    narrow: () => t('ms'),
  },
  {
    size: 0.001,
    regular: (count: number) => tn('microsecond', 'microseconds', count),
    short: () => 'μs',
    narrow: () => 'μs',
  },
] as const;

/** Format seconds using the shared application translations. */
export function getDuration(
  seconds: number,
  {
    precision = 0,
    style = 'regular',
    absolute = false,
    minimumUnit = 1,
  }: DurationOptions = {}
): string {
  const milliseconds = seconds * 1000;
  const magnitude = Math.abs(milliseconds);
  const unit =
    units.find(({size}) => magnitude >= size || minimumUnit === size) ?? units[8];
  const value = (absolute ? magnitude : milliseconds) / unit.size;
  const label = value.toFixed(precision);

  if (style !== 'regular') {
    return `${label}${unit[style]()}`;
  }

  const count = precision <= 0 ? Math.round(value) : value;
  return `${label} ${unit.regular(count)}`;
}
