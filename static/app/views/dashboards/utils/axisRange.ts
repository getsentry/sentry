export type AxisRange = 'auto' | 'dataMin';

export function getAxisRange(value: unknown): AxisRange | undefined {
  if (value === 'auto' || value === 'dataMin') {
    return value;
  }
  return undefined;
}
