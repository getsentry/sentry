export interface DurationOptions {
  absolute?: boolean;
  /** Smallest unit in milliseconds. Defaults to one millisecond. */
  minimumUnit?: number;
  precision?: number;
  style?: 'regular' | 'short' | 'narrow';
}

export type DurationFormatter = (seconds: number, options?: DurationOptions) => string;

export interface DurationTranslation {
  pgettext: (context: string, message: string) => string;
  t: (message: string) => string;
  tn: (singular: string, plural: string, count: number) => string;
}

const english: DurationTranslation = {
  t: message => message,
  tn: (singular, plural, count) => (count === 1 ? singular : plural),
  pgettext: (_context, message) => message,
};

const YEAR = 31536000000;
const MONTH = 2629800000;
const WEEK = 604800000;
const DAY = 86400000;
const HOUR = 3600000;
const MINUTE = 60000;
const SECOND = 1000;
const MILLISECOND = 1;
const MICROSECOND = 0.001;

function roundWithFixed(
  value: number,
  fixedDigits: number
): {label: string; result: number} {
  const label = value.toFixed(fixedDigits);
  const result = fixedDigits <= 0 ? Math.round(value) : value;

  return {label, result};
}

/** Build a duration formatter with application-supplied translations. */
export function createDurationFormatter({
  t,
  tn,
  pgettext,
}: DurationTranslation = english): DurationFormatter {
  const DURATION_LABELS = {
    y: t('y'),
    yr: t('yr'),
    year: t('year'),
    m_month: pgettext('abbreviated months', 'm'),
    mo: t('mo'),
    w: t('w'),
    wk: t('wk'),
    week: t('week'),
    weeks: t('weeks'),
    d: t('d'),
    day: t('day'),
    days: t('days'),
    h: t('h'),
    hr: t('hr'),
    hour: t('hour'),
    hours: t('hours'),
    m: pgettext('abbreviated minutes', 'm'),
    min: t('min'),
    minute: t('minute'),
    minutes: t('minutes'),
    s: t('s'),
    sec: t('sec'),
    secs: t('secs'),
    second: t('second'),
    seconds: t('seconds'),
    ms: t('ms'),
    millisecond: t('millisecond'),
    milliseconds: t('milliseconds'),
    us: 'μs', // SI units don't need a translation
    microsecond: t('microsecond'),
    microseconds: t('microseconds'),
  };

  return (
    seconds,
    {
      precision: fixedDigits = 0,
      style = 'regular',
      absolute = false,
      minimumUnit = MILLISECOND,
    } = {}
  ) => {
    const abbreviation = style === 'short';
    const extraShort = style === 'narrow';
    const absValue = Math.abs(seconds * 1000);

    // value in milliseconds
    const msValue = absolute ? absValue : seconds * 1000;

    if (absValue >= YEAR || minimumUnit === YEAR) {
      const {label, result} = roundWithFixed(msValue / YEAR, fixedDigits);
      if (extraShort) {
        return `${label}${DURATION_LABELS.y}`;
      }
      if (abbreviation) {
        return `${label}${DURATION_LABELS.yr}`;
      }
      return `${label}${abbreviation ? DURATION_LABELS.yr : ` ${tn('year', 'years', result)}`}`;
    }

    if (absValue >= MONTH || minimumUnit === MONTH) {
      const {label, result} = roundWithFixed(msValue / MONTH, fixedDigits);
      if (extraShort) {
        return `${label}${DURATION_LABELS.m_month}`;
      }
      if (abbreviation) {
        return `${label}${DURATION_LABELS.mo}`;
      }
      return `${label}${abbreviation ? DURATION_LABELS.mo : ` ${tn('month', 'months', result)}`}`;
    }

    if (absValue >= WEEK || minimumUnit === WEEK) {
      const {label, result} = roundWithFixed(msValue / WEEK, fixedDigits);
      if (extraShort) {
        return `${label}${DURATION_LABELS.w}`;
      }
      if (abbreviation) {
        return `${label}${DURATION_LABELS.wk}`;
      }
      return `${label} ${tn('week', 'weeks', result)}`;
    }

    if (absValue >= DAY || minimumUnit === DAY) {
      const {label, result} = roundWithFixed(msValue / DAY, fixedDigits);

      if (extraShort || abbreviation) {
        return `${label}${DURATION_LABELS.d}`;
      }
      return `${label} ${tn('day', 'days', result)}`;
    }

    if (absValue >= HOUR || minimumUnit === HOUR) {
      const {label, result} = roundWithFixed(msValue / HOUR, fixedDigits);
      if (extraShort) {
        return `${label}${DURATION_LABELS.h}`;
      }
      if (abbreviation) {
        return `${label}${DURATION_LABELS.hr}`;
      }
      return `${label} ${tn('hour', 'hours', result)}`;
    }

    if (absValue >= MINUTE || minimumUnit === MINUTE) {
      const {label, result} = roundWithFixed(msValue / MINUTE, fixedDigits);
      if (extraShort) {
        return `${label}${DURATION_LABELS.m}`;
      }
      if (abbreviation) {
        return `${label}${DURATION_LABELS.min}`;
      }
      return `${label} ${tn('minute', 'minutes', result)}`;
    }

    if (absValue >= SECOND || minimumUnit === SECOND) {
      const {label, result} = roundWithFixed(msValue / SECOND, fixedDigits);
      if (extraShort || abbreviation) {
        return `${label}${DURATION_LABELS.s}`;
      }
      return `${label} ${tn('second', 'seconds', result)}`;
    }

    if (absValue >= MILLISECOND || minimumUnit === MILLISECOND) {
      const {label, result} = roundWithFixed(msValue / MILLISECOND, fixedDigits);
      if (extraShort || abbreviation) {
        return `${label}${DURATION_LABELS.ms}`;
      }
      return `${label} ${tn('millisecond', 'milliseconds', result)}`;
    }

    const {label, result} = roundWithFixed(msValue / MICROSECOND, fixedDigits);

    if (extraShort || abbreviation) {
      return `${label}${DURATION_LABELS.us}`;
    }

    return `${label} ${tn('microsecond', 'microseconds', result)}`;
  };
}

export const getDuration: DurationFormatter = createDurationFormatter();
