export function formatTimeSeriesTransformations(
  transformations: readonly string[] = []
): string {
  return transformations.join(' → ');
}
