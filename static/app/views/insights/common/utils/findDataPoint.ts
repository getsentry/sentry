export function findSampleFromDataPoint<T extends {timestamp: string}>(
  dataPoint: {name: string | number; value: number},
  data: T[],
  matchKey: keyof T
) {
  return data?.find(
    s => s.timestamp === dataPoint.name && s[matchKey] === dataPoint.value
  );
}
