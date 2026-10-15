/**
 * Resolves the selected aggregate index, defaulting to the last aggregate.
 */
export function getSelectedAggregateIndex(
  selectedAggregate: number | undefined,
  aggregateCount: number
): number {
  if (selectedAggregate === undefined) {
    return aggregateCount > 0 ? aggregateCount - 1 : 0;
  }
  return Math.min(selectedAggregate, Math.max(0, aggregateCount - 1));
}
