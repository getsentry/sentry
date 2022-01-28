export function relativeChange(final: number, initial: number): number {
  return (final - initial) / initial;
}

type Unit = 'nanoseconds' | 'microseconds' | 'milliseconds' | 'seconds';

const durationMappings: Record<Unit, number> = {
  nanoseconds: 1e-9,
  microseconds: 1e-6,
  milliseconds: 1e-3,
  seconds: 1,
};

const format = (v: number, abbrev: string, precision: number) => {
  return v.toFixed(precision) + abbrev;
};

export function makeFormatter(from: Unit | string): (value: number) => string {
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format from unit ${from}, duration mapping is not defined`);
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
