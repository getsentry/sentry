import {defined} from 'sentry/utils/defined';
import {
  syncEquationMetricQueries,
  unresolveExpression,
} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {getMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {
  decodeMetricsQueryParams,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {spliceEquationQueries} from 'sentry/views/explore/metrics/utils';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';

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

  // Update the metric queries to have the correct equation references.
  // Mainly to ensure that preexisting equations now point to the correct aggregate
  // if a referenced metric was replaced.
  const syncedMetricQueries = syncEquationMetricQueries(
    updatedMetricQueries,
    previousEquationReferences,
    nextEquationReferences
  );

  const encodedMetrics = syncedMetricQueries
    .map(mq => encodeMetricQueryParams(mq))
    .filter(Boolean);

  const remainingSeerAggregates = [...extraAggregates, seerEquation];
  const spliceResult = spliceEquationQueries(
    encodedMetrics,
    remainingSeerAggregates.filter(defined)
  );

  // After splicing, set internalExpression on equations that don't already
  // have one by unresolving against the final reference map.
  if (spliceResult === 'applied') {
    const finalQueries = encodedMetrics.map(decodeMetricsQueryParams).filter(defined);
    const finalRefs = getMetricReferences(finalQueries);

    for (let i = 0; i < encodedMetrics.length; i++) {
      const decoded = finalQueries[i];
      const viz = decoded?.queryParams.visualizes[0];
      if (viz && isVisualizeEquation(viz) && !viz.internalExpression) {
        const internal = unresolveExpression(viz.expression.text, finalRefs);
        const updated = {
          ...decoded,
          queryParams: decoded.queryParams.replace({
            aggregateFields: [viz.replace({internalExpression: internal})],
          }),
        };
        encodedMetrics[i] = encodeMetricQueryParams(updated);
      }
    }
  }

  return {
    encodedMetrics,
    spliceResult,
  };
}
