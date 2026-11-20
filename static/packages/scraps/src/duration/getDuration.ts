import {getSnapshot} from '../dateTime/config';
import type {Translation} from '../translation/translate';

export interface DurationOptions {
  absolute?: boolean;
  /** Smallest display unit. Defaults to milliseconds. */
  minimumUnit?: DurationUnit;
  precision?: number;
  style?: 'long' | 'short' | 'narrow';
}

const units = [
  {
    unit: 'year',
    size: 31536000000,
    long: (count: number, {tn}: Translation) => tn('year', 'years', count),
    short: ({t}: Translation) => t('yr'),
    narrow: ({t}: Translation) => t('y'),
  },
  {
    unit: 'month',
    size: 2629800000,
    long: (count: number, {tn}: Translation) => tn('month', 'months', count),
    short: ({t}: Translation) => t('mo'),
    narrow: ({pgettext}: Translation) => pgettext('abbreviated months', 'm'),
  },
  {
    unit: 'week',
    size: 604800000,
    long: (count: number, {tn}: Translation) => tn('week', 'weeks', count),
    short: ({t}: Translation) => t('wk'),
    narrow: ({t}: Translation) => t('w'),
  },
  {
    unit: 'day',
    size: 86400000,
    long: (count: number, {tn}: Translation) => tn('day', 'days', count),
    short: ({t}: Translation) => t('d'),
    narrow: ({t}: Translation) => t('d'),
  },
  {
    unit: 'hour',
    size: 3600000,
    long: (count: number, {tn}: Translation) => tn('hour', 'hours', count),
    short: ({t}: Translation) => t('hr'),
    narrow: ({t}: Translation) => t('h'),
  },
  {
    unit: 'minute',
    size: 60000,
    long: (count: number, {tn}: Translation) => tn('minute', 'minutes', count),
    short: ({t}: Translation) => t('min'),
    narrow: ({pgettext}: Translation) => pgettext('abbreviated minutes', 'm'),
  },
  {
    unit: 'second',
    size: 1000,
    long: (count: number, {tn}: Translation) => tn('second', 'seconds', count),
    short: ({t}: Translation) => t('s'),
    narrow: ({t}: Translation) => t('s'),
  },
  {
    unit: 'millisecond',
    size: 1,
    long: (count: number, {tn}: Translation) => tn('millisecond', 'milliseconds', count),
    short: ({t}: Translation) => t('ms'),
    narrow: ({t}: Translation) => t('ms'),
  },
  {
    unit: 'microsecond',
    size: 0.001,
    long: (count: number, {tn}: Translation) => tn('microsecond', 'microseconds', count),
    short: () => 'μs',
    narrow: () => 'μs',
  },
] as const;

export type DurationUnit = (typeof units)[number]['unit'];

/** Format seconds using the shared application translations. */
export function getDuration(seconds: number, options: DurationOptions = {}): string {
  return getDurationWithMessages(seconds, options, getSnapshot().messages);
}

export function getDurationWithMessages(
  seconds: number,
  {
    precision = 0,
    style = 'long',
    absolute = false,
    minimumUnit = 'millisecond',
  }: DurationOptions,
  messages: Translation
): string {
  const milliseconds = seconds * 1000;
  const magnitude = Math.abs(milliseconds);
  const unit =
    units.find(({size, unit}) => magnitude >= size || minimumUnit === unit) ?? units[8];
  const value = (absolute ? magnitude : milliseconds) / unit.size;
  const label = value.toFixed(precision);

  if (style !== 'long') {
    return `${label}${unit[style](messages)}`;
  }

  const count = precision <= 0 ? Math.round(value) : value;
  return `${label} ${unit.long(count, messages)}`;
}
