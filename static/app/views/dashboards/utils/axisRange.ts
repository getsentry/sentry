export const AXIS_RANGE_AUTO = 'auto';
export const AXIS_RANGE_DATA_MIN = 'dataMin';

export type AxisRange = typeof AXIS_RANGE_AUTO | typeof AXIS_RANGE_DATA_MIN;

export function isAxisRange(value: unknown): value is AxisRange {
  return value === AXIS_RANGE_AUTO || value === AXIS_RANGE_DATA_MIN;
}

export function getAxisRange(value: unknown): AxisRange | undefined {
  return isAxisRange(value) ? value : undefined;
}
