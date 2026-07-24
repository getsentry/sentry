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
import {getFunctionLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

interface ApplySeerEquationParams {
  interactedQueryParams: ReadableQueryParams;
  metricQueries: BaseMetricQuery[];
  seerMetricQueries: BaseMetricQuery[];
  replaceLabel?: (position: number, label: string) => void;
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
 * Updates metric queries by applying Seer-generated aggregates or equations based on user interaction.
 *
 * Swaps in Seer aggregates/equations for the interacted row, updates label references for equations,
 * and optionally supports non-equation replacements. Returns updated, encoded metric queries and the result of equation splicing
 * in case there was not enough space to fit all the Seer-generated aggregates/equations.
 */
export function applySeerResultsToMetricQueries({
  metricQueries,
  interactedQueryParams,
  seerMetricQueries,
  seerAggregateReplacement,
  replaceLabel,
}: ApplySeerEquationParams): ApplySeerEquationResult {
  const seerEquation = seerMetricQueries.find(
    mq =>
      mq.queryParams.visualizes[0] && isVisualizeEquation(mq.queryParams.visualizes[0])
  );
  const seerAggregates = seerMetricQueries.filter(
    mq => !isVisualizeEquation(mq.queryParams.visualizes[0]!)
  );
  const [replacementAggregate, ...extraAggregates] = seerAggregates;

  const interactedViz = interactedQueryParams.visualizes[0];
  const interactedIsEquation = interactedViz && isVisualizeEquation(interactedViz);

  const previousEquationReferences = getMetricReferences(metricQueries);

  // Replace like with like: equations replace equations, aggregates replace aggregates.
  // When seer returns no equation for an interacted equation, drop it — the
  // seer aggregates will be spliced in by spliceEquationQueries.
  const updatedMetricQueries = metricQueries
    .map((mq, i) => {
      if (mq.queryParams === interactedQueryParams) {
        if (interactedIsEquation && seerEquation) {
          return {...seerEquation, label: mq.label};
        }

        if (interactedIsEquation && !seerEquation) {
          if (seerAggregateReplacement) {
            const aggregateCount = metricQueries.filter(
              q => !isVisualizeEquation(q.queryParams.visualizes[0]!)
            ).length;
            const newLabel = getFunctionLabel(aggregateCount);
            replaceLabel?.(i, newLabel);
            return {
              ...mq,
              label: newLabel,
              metric: seerAggregateReplacement.metric,
              queryParams: seerAggregateReplacement.queryParams,
            };
          }
        }

        if (!interactedIsEquation && seerEquation && replacementAggregate) {
          return {...replacementAggregate, label: mq.label};
        }

        if (seerAggregateReplacement) {
          return {
            ...mq,
            metric: seerAggregateReplacement.metric,
            queryParams: seerAggregateReplacement.queryParams,
          };
        }
      }
      return mq;
    })
    .filter(defined);

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

  const remainingToSplice = interactedIsEquation
    ? seerAggregates
    : [...extraAggregates, seerEquation].filter(defined);
  const spliceResult = spliceEquationQueries(encodedMetrics, remainingToSplice);

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
