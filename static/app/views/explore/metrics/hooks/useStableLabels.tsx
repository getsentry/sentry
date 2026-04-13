import {useMemo, useRef} from 'react';

import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {
  getFunctionLabel,
  getVisualizeLabel,
} from 'sentry/views/explore/toolbar/toolbarVisualize';

/**
 * Assigns sequential labels to queries based on their type.
 * Metrics get letter labels (A, B, C...), equations get function labels (ƒ1, ƒ2...).
 */
function assignSequentialLabels(queries: BaseMetricQuery[]): string[] {
  let nextMetricIndex = 0;
  let nextEquationIndex = 1;
  return queries.map(query => {
    const isEquation = isVisualizeEquation(query.queryParams.visualizes[0]!);
    return getVisualizeLabel(
      isEquation ? nextEquationIndex++ : nextMetricIndex++,
      isEquation
    );
  });
}

/**
 * Returns the next available label for the given query type.
 */
export function getNextLabel(
  metricQueries: BaseMetricQuery[],
  type: 'aggregate' | 'equation'
): string {
  const isEquation = type === 'equation';
  const queryFilter = isEquation ? isVisualizeEquation : isVisualizeFunction;
  const relevant = metricQueries.filter(q => queryFilter(q.queryParams.visualizes[0]!));
  if (relevant.length === 0) {
    return getVisualizeLabel(isEquation ? 1 : 0, isEquation);
  }
  const maxIndex = Math.max(
    ...relevant.map((q, i) => {
      const label = q.label;
      if (!label) {
        return i;
      }
      return isEquation ? parseEquationIndex(label) : parseFunctionIndex(label);
    })
  );
  return getVisualizeLabel(maxIndex + 1, isEquation);
}

/**
 * Parses "A" → 0, "B" → 1, etc.
 */
function parseFunctionIndex(label: string): number {
  return label.charCodeAt(0) - 'A'.charCodeAt(0);
}

/**
 * Parses "ƒ1" → 1, "ƒ2" → 2, etc.
 */
function parseEquationIndex(label: string): number {
  return parseInt(label.slice(1), 10) || 0;
}

/**
 * Maintains stable labels across query mutations within a session.
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
export function useStableLabels(queries: BaseMetricQuery[]) {
  const labelsRef = useRef<string[]>([]);

  if (labelsRef.current.length !== queries.length) {
    labelsRef.current = assignSequentialLabels(queries);
  }

  return useMemo(
    () => ({
      getLabel(i: number): string {
        return labelsRef.current[i] ?? getFunctionLabel(i);
      },
      insert(position: number, label: string) {
        labelsRef.current = labelsRef.current.toSpliced(position, 0, label);
      },
      remove(position: number) {
        labelsRef.current = labelsRef.current.filter((_, j) => j !== position);
      },
    }),
    []
  );
}
