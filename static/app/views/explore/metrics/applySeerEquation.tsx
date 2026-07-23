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
import {
  isVisualize,
  isVisualizeEquation,
} from 'sentry/views/explore/queryParams/visualize';
import {getFunctionLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

interface ApplySeerEquationParams {
  interactedQueryParams: ReadableQueryParams;
  metricQueries: BaseMetricQuery[];
  seerAggregates: BaseMetricQuery[];
  seerEquations: BaseMetricQuery[];
  nonEquationReplacement?: {
    metric: TraceMetric;
    queryParams: ReadableQueryParams;
  };
}

interface ApplySeerEquationResult {
  encodedMetrics: string[];
  spliceResult: ReturnType<typeof spliceEquationQueries>;
}

export function applySeerEquation({
  metricQueries,
  interactedQueryParams,
  seerAggregates,
  seerEquations,
  nonEquationReplacement,
}: ApplySeerEquationParams): ApplySeerEquationResult {
  const hasEquation = seerAggregates.length + seerEquations.length > 0;
  const [replacementAggregate, ...extraAggregates] = seerAggregates;

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
  if (hasEquation && isInteractedEquation && interactedIndex >= 0) {
    const aggregatesBefore = metricQueries
      .slice(0, interactedIndex)
      .filter(mq => !isVisualizeEquation(mq.queryParams.visualizes[0]!)).length;
    replacementAggregateLabel = getFunctionLabel(aggregatesBefore);
  }

  const previousRefs = getMetricReferences(metricQueries);

  let updatedMetricQueries = metricQueries.map(mq => {
    if (mq.queryParams === interactedQueryParams) {
      if (hasEquation && replacementAggregate) {
        return {
          ...replacementAggregate,
          label: replacementAggregateLabel ?? mq.label,
        };
      }
      if (nonEquationReplacement) {
        return {
          ...mq,
          metric: nonEquationReplacement.metric,
          queryParams: nonEquationReplacement.queryParams,
        };
      }
    }
    return mq;
  });

  // Re-resolve existing equations' yAxis against the updated reference
  // map so charts query the new aggregate. Preserve the original
  // internalExpression exactly — syncEquationMetricQueries round-trips
  // it through unresolveExpression which can alter whitespace/ordering.
  const nextRefs = getMetricReferences(updatedMetricQueries);
  const synced = syncEquationMetricQueries(updatedMetricQueries, previousRefs, nextRefs);
  updatedMetricQueries = synced.map((mq, i) => {
    const original = updatedMetricQueries[i]!;
    if (mq === original) {
      return mq;
    }
    const origViz = original.queryParams.visualizes[0];
    if (!origViz || !isVisualizeEquation(origViz)) {
      return mq;
    }
    return {
      ...mq,
      queryParams: mq.queryParams.replace({
        aggregateFields: mq.queryParams.aggregateFields.map(field =>
          isVisualize(field) && isVisualizeEquation(field)
            ? field.replace({internalExpression: origViz.internalExpression})
            : field
        ),
      }),
    };
  });

  const encodedMetrics = updatedMetricQueries
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
  if (hasEquation && remapLabel) {
    fullRemap[getFunctionLabel(0)] = remapLabel;
  }
  for (let i = 0; i < extraAggregates.length; i++) {
    fullRemap[getFunctionLabel(i + 1)] = getFunctionLabel(insertionOffset + i);
  }

  const allSeerQueries = [...extraAggregates, ...seerEquations];

  // TODO: I was removing the relabelling and it seemed to have work but it still needs me to pass this along.
  const spliceResult = spliceEquationQueries(encodedMetrics, allSeerQueries);

  return {
    encodedMetrics,
    spliceResult,
  };
}
