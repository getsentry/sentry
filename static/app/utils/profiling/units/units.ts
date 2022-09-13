export function relativeChange(final: number, initial: number): number {
  return (final - initial) / initial;
}

export type ProfilingFormatterUnit =
  | 'nanoseconds'
  | 'microseconds'
  | 'milliseconds'
  | 'seconds';

const durationMappings: Record<ProfilingFormatterUnit, number> = {
  nanoseconds: 1e-9,
  microseconds: 1e-6,
  milliseconds: 1e-3,
  seconds: 1,
};

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
  return v.toFixed(precision) + abbrev;
};

export function makeFormatter(
  from: ProfilingFormatterUnit | string
): (value: number) => string {
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format unit ${from}, duration mapping is not defined`);
  }

  return (value: number) => {
    const duration = value * multiplier;

    if (duration >= 1) {
      return format(duration, 's', 2);
    }
    if (duration / 1e-3 >= 1) {
      return format(duration / 1e-3, 'ms', 2);
    }
    if (duration / 1e-6 >= 1) {
      return format(duration / 1e-6, 'μs', 2);
    }
    return format(duration / 1e-9, 'ns', 2);
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
    const s = value * multiplier;
    const m = s / 60;
    const ms = s * 1e3;

    return `${pad(m, 2)}:${pad(s % 60, 2)}.${pad(ms % 1e3, 3)}`;
  };
}
