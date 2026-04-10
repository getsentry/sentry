import {useMemo, useRef} from 'react';

import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

/**
 * Assigns sequential label indices to queries based on their type.
 * Metrics get 0-based indices (A, B, C...), equations get 1-based (f1, f2...).
 */
function assignSequentialLabels(queries: BaseMetricQuery[]): number[] {
  let nextMetricIndex = 0;
  let nextEquationIndex = 1;
  return queries.map(query => {
    const isEquation = isVisualizeEquation(query.queryParams.visualizes[0]!);
    return isEquation ? nextEquationIndex++ : nextMetricIndex++;
  });
}

/**
 * Returns the next available label index for the given query type.
 * Metrics are 0-based (A=0, B=1...), equations are 1-based (f1=1, f2=2...).
 */
export function getNextLabelIndex(
  metricQueries: BaseMetricQuery[],
  type: 'aggregate' | 'equation'
): number {
  const queryFilter = type === 'equation' ? isVisualizeEquation : isVisualizeFunction;
  const relevant = metricQueries.filter(q => queryFilter(q.queryParams.visualizes[0]!));
  if (relevant.length === 0) {
    return type === 'equation' ? 1 : 0;
  }
  return Math.max(...relevant.map((q, i) => q.labelIndex ?? i)) + 1;
}

/**
 * Maintains stable label indices across query mutations within a session.
 *
 * Labels are compacted sequentially (A, B, C...) on fresh page loads, but
 * preserved with gaps during a session (e.g. deleting B keeps A, C rather
 * than reassigning to A, B).
 *
 * The ref tracks label assignments across URL navigations. Mutations (insert/remove)
 * update the ref before navigating so the next render preserves the labels.
 * When the ref length doesn't match the query count (fresh load or external
 * navigation), labels are reassigned sequentially.
 */
export function useStableLabelIndices(queries: BaseMetricQuery[]) {
  const indicesRef = useRef<number[]>([]);

  if (indicesRef.current.length !== queries.length) {
    indicesRef.current = assignSequentialLabels(queries);
  }

  return useMemo(
    () => ({
      getLabel(i: number): number {
        return indicesRef.current[i] ?? i;
      },
      insert(position: number, labelIndex: number) {
        indicesRef.current = indicesRef.current.toSpliced(position, 0, labelIndex);
      },
      remove(position: number) {
        indicesRef.current = indicesRef.current.filter((_, j) => j !== position);
      },
    }),
    []
  );
}
