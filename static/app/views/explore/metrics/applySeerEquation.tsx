import {defined} from 'sentry/utils/defined';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {syncEquationMetricQueries} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {getMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {spliceEquationQueries} from 'sentry/views/explore/metrics/utils';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';
import {getFunctionLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

interface ApplySeerEquationParams {
  interactedQueryParams: ReadableQueryParams;
  metricQueries: BaseMetricQuery[];
  seerMetricQueries: BaseMetricQuery[];
  seerAggregateReplacement?: {
    metric: TraceMetric;
    queryParams: ReadableQueryParams;
  };
}

interface ApplySeerEquationResult {
  encodedMetrics: string[];
  spliceResult: ReturnType<typeof spliceEquationQueries>;
}

/**
 * Applies Seer-generated equations or aggregates to metric queries after a user interacts
 * within the metrics explorer. The function is structured in logical steps (chunks)
 * to clarify its operation and surface any redundant or decomposable work:
 *
 * **Main chunks of the process:**
 * 1. **Detection:** Determines if Seer equation(s) or aggregate(s) are present, and identifies which metric query row was interacted with.
 * 2. **Replacement Preparation:**
 *    - Analyzes whether the interacted row is an equation or an aggregate.
 *    - Calculates the correct label for a replacement aggregate if necessary (e.g., assigning a sequential label for aggregates within equations).
 *    - Captures existing metric references for future synchronization.
 * 3. **Replacement Application:** Builds a new metric query array:
 *    - Replaces the interacted row either with a Seer-generated aggregate/equation or swaps in a non-equation replacement metric (if specified).
 *    - Ensures label consistency for aggregates and equations to maintain correctness in equation evaluation.
 * 4. **Encoding and Splicing:**
 *    - Encodes the updated set of metric queries for further processing.
 *    - Applies any required splicing of equation/aggregate sequences for proper visual and logical order.
 *
 * **Summary:**
 * This function thus modularly:
 *   - Swaps in aggregates/equations after interacting with a metric row.
 *   - Maintains correct label assignment for equation parsing.
 *   - Supports non-equation replacement if provided.
 *   - Returns both the encoded metric queries and the splice operation result.
 *
 * @param params - Encapsulates the current metric queries, the row interacted with, Seer-provided aggregates and equations, and (optionally) details for a non-equation replacement.
 * @returns An object with (a) an updated, encoded metrics list and (b) the result of the equation splicing operation.
 */

export function applySeerResultsToMetricQueries({
  metricQueries,
  interactedQueryParams,
  seerMetricQueries,
  seerAggregateReplacement,
}: ApplySeerEquationParams): ApplySeerEquationResult {
  const seerEquation = seerMetricQueries.find(
    mq =>
      mq.queryParams.visualizes[0] && isVisualizeEquation(mq.queryParams.visualizes[0])
  );
  const [replacementAggregate, ...extraAggregates] = seerMetricQueries.filter(
    mq => !isVisualizeEquation(mq.queryParams.visualizes[0]!)
  );

  const interactedRow = metricQueries.find(
    mq => mq.queryParams === interactedQueryParams
  );
  const interactedIndex = metricQueries.findIndex(
    mq => mq.queryParams === interactedQueryParams
  );

  // When the interacted row is an equation, the replacement aggregate
  // needs a letter label (A, B, C…) rather than inheriting the
  // equation's ƒn label, because ƒn labels are reserved for equations
  // and will break the equation's internalExpression after labels are
  // reassigned sequentially on the next render.
  const isInteractedEquation =
    interactedRow && isVisualizeEquation(interactedRow.queryParams.visualizes[0]!);
  let replacementAggregateLabel: string | undefined;
  if (seerEquation && isInteractedEquation && interactedIndex >= 0) {
    const aggregatesBefore = metricQueries
      .slice(0, interactedIndex)
      .filter(mq => !isVisualizeEquation(mq.queryParams.visualizes[0]!)).length;
    replacementAggregateLabel = getFunctionLabel(aggregatesBefore);
  }

  const previousEquationReferences = getMetricReferences(metricQueries);

  // Replaces the interacted row with the Seer-generated aggregate or the replacement metric from the equation.
  // The other rows will be left
  const updatedMetricQueries = metricQueries.map(mq => {
    if (mq.queryParams === interactedQueryParams) {
      if (seerEquation && replacementAggregate) {
        return {
          ...replacementAggregate,
          label: mq.label,
        };
      }

      if (seerAggregateReplacement) {
        // For non-equation replacement
        return {
          ...mq,
          metric: seerAggregateReplacement.metric,
          queryParams: seerAggregateReplacement.queryParams,
        };
      }
    }
    return mq;
  });

  // Re-resolve existing equations' yAxis against the updated reference
  // map so charts query the new aggregate. Preserve the original
  // internalExpression exactly — syncEquationMetricQueries round-trips
  // it through unresolveExpression which can alter whitespace/ordering.
  const nextEquationReferences = getMetricReferences(updatedMetricQueries);

  // Update the metric queries to have the correct equation references
  // e.g. handles when user interacts with a metric query that is used in a
  // preexisting equation.
  const syncedMetricQueries = syncEquationMetricQueries(
    updatedMetricQueries,
    previousEquationReferences,
    nextEquationReferences
  );

  const encodedMetrics = syncedMetricQueries
    .map(mq => encodeMetricQueryParams(mq))
    .filter(Boolean);

  // Build a single remap table for ALL of Seer's aggregates so the
  // equation's internalExpression references the correct final labels.
  // The first aggregate (A) replaces the interacted row, so it maps to
  // the interacted label. The remaining aggregates are spliced at the
  // insertion offset, so they get sequential labels from there.
  const eqStartIdx = encodedMetrics.findIndex(e => e.includes(EQUATION_PREFIX));
  const insertionOffset = eqStartIdx === -1 ? encodedMetrics.length : eqStartIdx;

  const fullRemap: Record<string, string> = {};
  const remapLabel = replacementAggregateLabel ?? interactedRow?.label;
  if (seerEquation && remapLabel) {
    fullRemap[getFunctionLabel(0)] = remapLabel;
  }
  for (let i = 0; i < extraAggregates.length; i++) {
    fullRemap[getFunctionLabel(i + 1)] = getFunctionLabel(insertionOffset + i);
  }

  // TODO: See why this is actually the seer queries minus the replacement aggregate.
  const allSeerQueries = [...extraAggregates, seerEquation];
  const spliceResult = spliceEquationQueries(
    encodedMetrics,
    allSeerQueries.filter(defined)
  );

  return {
    encodedMetrics,
    spliceResult,
  };
}
