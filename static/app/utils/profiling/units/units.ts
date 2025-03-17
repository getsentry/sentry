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
  | 'count'
  | 'percent'
  | 'percents'
  | 'byte'
  | 'bytes'
  | 'nanojoule'
  | 'nanojoules'
  | 'watt'
  | 'watts';

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
  percent: 1,
  percents: 1,
  byte: 1,
  bytes: 1,
  nanojoule: 1e-9,
  nanojoules: 1e-9,
  watt: 1,
  watts: 1,
};

export function assertValidProfilingUnit(
  unit: string
): asserts unit is ProfilingFormatterUnit {
  if (unit in durationMappings) {
    return;
  }
  throw new Error(`Invalid profiling unit: ${unit}`);
}

export function fromNanoJoulesToWatts(nanojoules: number, seconds: number) {
  const joules = nanojoules * durationMappings.nanojoules;
  return joules / seconds;
}

export function makeFormatTo(
  from: ProfilingFormatterUnit | string,
  to: ProfilingFormatterUnit | string
) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (durationMappings[from] === undefined) {
    throw new Error(`Cannot format unit ${from}, duration mapping is not defined`);
  }
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const fromMultiplier = Math.log10(durationMappings[from]);
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
  from: ProfilingFormatterUnit | string,
  precision = 2
): (value: number) => string {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format unit ${from}, duration mapping is not defined`);
  }

  if (from === 'count') {
    return (value: number) => {
      return value.toFixed(precision);
    };
  }
  if (from === 'percent' || from === 'percents') {
    return (value: number) => {
      return value.toFixed(precision) + '%';
    };
  }

  if (from === 'byte' || from === 'bytes') {
    return (value: number) => {
      if (value === 0) {
        return '0B';
      }
      const byteUnits = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(value) / Math.log(1000));
      if (i < 0) {
        return value.toFixed(precision) + byteUnits[0];
      }
      return (value / Math.pow(1000, i)).toFixed(precision) + byteUnits[i];
    };
  }

  if (from === 'nanojoule' || from === 'nanojoules') {
    return (value: number) => {
      if (value === 0) {
        return '0J';
      }

      value *= durationMappings[from];
      const jouleUnits = ['J', 'kJ', 'MJ', 'GJ'];
      const i = Math.floor(Math.log(value) / Math.log(1000));

      if (i < 0) {
        return value.toFixed(precision) + jouleUnits[0];
      }
      return (value / Math.pow(1000, i)).toFixed(precision) + (jouleUnits[i] ?? 'J');
    };
  }

  if (from === 'watt' || from === 'watts') {
    return (value: number) => {
      if (value === 0) {
        return '0W';
      }

      value *= durationMappings[from];
      const jouleUnits = ['W', 'kW', 'MW', 'GW'];
      const i = Math.floor(Math.log(value) / Math.log(1000));
      if (i < 0) {
        return value.toFixed(precision) + jouleUnits[0];
      }
      return (value / Math.pow(1000, i)).toFixed(precision) + jouleUnits[i];
    };
  }

  return function formatToDuration(value: number): string {
    const duration = value * multiplier;

    if (duration >= 1) {
      return format(duration, 's', precision);
    }
    if (duration / 1e-3 >= 1) {
      return format(duration / 1e-3, 'ms', precision);
    }
    if (duration / 1e-6 >= 1) {
      return format(duration / 1e-6, 'μs', precision);
    }
    return format(duration / 1e-9, 'ns', precision);
  };
}

function pad(n: number, slots: number) {
  return Math.floor(n).toString().padStart(slots, '0');
}

export function makeTimelineFormatter(from: ProfilingFormatterUnit | string) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

export function relativeWeight(base: number, value: number) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }
  return (value / base) * 100;
}
