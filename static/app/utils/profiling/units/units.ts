export function relativeChange(final: number, initial: number): number {
  return (final - initial) / initial;
}

/**
 * Contains both singular and plural forms of units because the backend currently
 * returns different units between profiles and measurements
 */
export type ProfilingFormatterUnit =
  | 'nanosecond'
  | 'nanoseconds'
  | 'microsecond'
  | 'microseconds'
  | 'millisecond'
  | 'milliseconds'
  | 'second'
  | 'seconds'
  | 'count';

const durationMappings: Record<ProfilingFormatterUnit, number> = {
  nanosecond: 1e-9,
  nanoseconds: 1e-9,
  microsecond: 1e-6,
  microseconds: 1e-6,
  millisecond: 1e-3,
  milliseconds: 1e-3,
  second: 1,
  seconds: 1,
  count: 1,
};

export function makeFormatTo(
  from: ProfilingFormatterUnit | string,
  to: ProfilingFormatterUnit | string
) {
  if (durationMappings[from] === undefined) {
    throw new Error(`Cannot format unit ${from}, duration mapping is not defined`);
  }
  if (durationMappings[to] === undefined) {
    throw new Error(`Cannot format unit ${from}, duration mapping is not defined`);
  }
  if (from === to) {
    return (v: number) => {
      return v;
    };
  }
  return function format(v: number) {
    return formatTo(v, from, to);
  };
}
export function formatTo(
  v: number,
  from: ProfilingFormatterUnit | string,
  to: ProfilingFormatterUnit | string
) {
  const fromMultiplier = Math.log10(durationMappings[from]);
  const toMultiplier = Math.log10(durationMappings[to]);
  const value = v * Math.pow(10, fromMultiplier - toMultiplier);
  return value;
}

const format = (v: number, abbrev: string, precision: number) => {
  if (v === 0) {
    return '0' + abbrev;
  }
  return v.toFixed(precision) + abbrev;
};

export function makeFormatter(
  from: ProfilingFormatterUnit | string
): (value: number) => string {
  const DEFAULT_PRECISION = 2;
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format unit ${from}, duration mapping is not defined`);
  }

  if (from === 'count') {
    return (value: number) => {
      return value.toFixed(0);
    };
  }

  return (value: number) => {
    const duration = value * multiplier;

    if (duration >= 1) {
      return format(duration, 's', DEFAULT_PRECISION);
    }
    if (duration / 1e-3 >= 1) {
      return format(duration / 1e-3, 'ms', DEFAULT_PRECISION);
    }
    if (duration / 1e-6 >= 1) {
      return format(duration / 1e-6, 'μs', DEFAULT_PRECISION);
    }
    return format(duration / 1e-9, 'ns', DEFAULT_PRECISION);
  };
}

function pad(n: number, slots: number) {
  return Math.floor(n).toString().padStart(slots, '0');
}

export function makeTimelineFormatter(from: ProfilingFormatterUnit | string) {
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format unit ${from}, duration mapping is not defined`);
  }

  return (value: number) => {
    const s = Math.abs(value * multiplier);
    const m = s / 60;
    const ms = s * 1e3;

    return `${value < 0 ? '-' : ''}${pad(m, 2)}:${pad(s % 60, 2)}.${pad(ms % 1e3, 3)}`;
  };
}
