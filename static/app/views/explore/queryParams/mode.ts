export enum Mode {
  SAMPLES = 'samples',
  AGGREGATE = 'aggregate',
}

export function defaultMode(): Mode {
  return Mode.SAMPLES;
}
