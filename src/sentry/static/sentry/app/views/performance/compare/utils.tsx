import jaro from 'wink-jaro-distance';

import {SentryTransactionEvent} from 'app/types';
import {RawSpanType, SpanType} from 'app/components/events/interfaces/spans/types';
import {
  parseTrace,
  generateRootSpan,
  isOrphanSpan,
  toPercent,
} from 'app/components/events/interfaces/spans/utils';

// Minimum threshold score for descriptions that are similar.
const COMMON_SIMILARITY_DESCRIPTION_THRESHOLD = 0.8;

export function isTransactionEvent(event: any): event is SentryTransactionEvent {
  if (!event) {
    return false;
  }

  return event?.type === 'transaction';
}

export type DiffSpanType =
  | {
      comparisonResult: 'matched';
      span_id: SpanId; // baselineSpan.span_id + regressionSpan.span_id
      op: string | undefined;
      description: string | undefined;
      baselineSpan: SpanType;
      regressionSpan: SpanType;
    }
  | {
      comparisonResult: 'baseline';
      baselineSpan: SpanType;
    }
  | {
      comparisonResult: 'regression';
      regressionSpan: SpanType;
    };

type ComparableSpan = {
  type: 'descendent';
  parent_span_id: SpanId;
  baselineSpan: SpanType;
  regressionSpan: SpanType;
};

type SpanId = string;

// map span_id to children whose parent_span_id is equal to span_id
// invariant: spans that are matched will have children in this lookup map
export type SpanChildrenLookupType = Record<SpanId, Array<DiffSpanType>>;

export type ComparisonReport = {
  rootSpans: Array<DiffSpanType>;

  childSpans: SpanChildrenLookupType;
};

export function diffTransactions({
  baselineEvent,
  regressionEvent,
}: {
  baselineEvent: SentryTransactionEvent;
  regressionEvent: SentryTransactionEvent;
}): ComparisonReport {
  const baselineTrace = parseTrace(baselineEvent);
  const regressionTrace = parseTrace(regressionEvent);

  const rootSpans: Array<DiffSpanType> = [];
  const childSpans: SpanChildrenLookupType = {};

  // merge childSpans of baselineTrace and regressionTrace together
  for (const [parentSpanId, children] of Object.entries(baselineTrace.childSpans)) {
    childSpans[parentSpanId] = children.map(baselineSpan => {
      return {
        comparisonResult: 'baseline',
        baselineSpan,
      };
    });
  }

  for (const [parentSpanId, children] of Object.entries(regressionTrace.childSpans)) {
    childSpans[parentSpanId] = children.map(regressionSpan => {
      return {
        comparisonResult: 'regression',
        regressionSpan,
      };
    });
  }

  // merge the two transaction's span trees

  // we maintain a stack of spans to be compared
  const spansToBeCompared: Array<
    | {
        type: 'root';
        baselineSpan: RawSpanType;
        regressionSpan: RawSpanType;
      }
    | ComparableSpan
  > = [
    {
      type: 'root',
      baselineSpan: generateRootSpan(baselineTrace),
      regressionSpan: generateRootSpan(regressionTrace),
    },
  ];

  while (spansToBeCompared.length > 0) {
    const currentSpans = spansToBeCompared.pop();

    if (!currentSpans) {
      // typescript assumes currentSpans is undefined due to the nature of Array.prototype.pop()
      // returning undefined if spansToBeCompared is empty. the loop invariant guarantees that spansToBeCompared
      // is a non-empty array. we handle this case for sake of completeness
      break;
    }

    // invariant: the parents of currentSpans are matched spans; with the exception of the root spans of the baseline
    //            transaction and the regression transaction.
    // invariant: any unvisited siblings of currentSpans are in spansToBeCompared.
    // invariant: currentSpans and their siblings are already in childSpans

    const {baselineSpan, regressionSpan} = currentSpans;

    // The span from the base transaction is considered 'identical' to the span from the regression transaction
    // only if they share the same op name, depth level, and description.
    //
    // baselineSpan and regressionSpan have equivalent depth levels due to the nature of the tree traversal algorithm.

    if (matchableSpans({baselineSpan, regressionSpan}) === 0) {
      if (currentSpans.type === 'root') {
        const spanComparisonResults: [DiffSpanType, DiffSpanType] = [
          {
            comparisonResult: 'baseline',
            baselineSpan,
          },
          {
            comparisonResult: 'regression',
            regressionSpan,
          },
        ];

        rootSpans.push(...spanComparisonResults);
      }

      // since baselineSpan and regressionSpan are considered not identical, we do not
      // need to compare their sub-trees

      continue;
    }

    const spanComparisonResult: DiffSpanType = {
      comparisonResult: 'matched',
      span_id: generateMergedSpanId({baselineSpan, regressionSpan}),
      op: baselineSpan.op,
      description: baselineSpan.description,
      baselineSpan,
      regressionSpan,
    };

    if (currentSpans.type === 'root') {
      rootSpans.push(spanComparisonResult);
    }

    const {comparablePairs, children} = createChildPairs({
      parent_span_id: spanComparisonResult.span_id,
      baseChildren: baselineTrace.childSpans[baselineSpan.span_id] ?? [],
      regressionChildren: regressionTrace.childSpans[regressionSpan.span_id] ?? [],
    });

    spansToBeCompared.push(...comparablePairs);

    if (children.length > 0) {
      childSpans[spanComparisonResult.span_id] = children;
    }
  }

  rootSpans.sort(sortByMostTimeAdded);

  const report = {
    rootSpans,
    childSpans,
  };

  return report;
}

function createChildPairs({
  parent_span_id,
  baseChildren,
  regressionChildren,
}: {
  parent_span_id: SpanId;
  baseChildren: Array<SpanType>;
  regressionChildren: Array<SpanType>;
}): {
  comparablePairs: Array<ComparableSpan>;
  children: Array<DiffSpanType>;
} {
  // invariant: the parents of baseChildren and regressionChildren are matched spans

  // for each child in baseChildren, pair them with the closest matching child in regressionChildren

  const comparablePairs: Array<ComparableSpan> = [];
  const children: Array<DiffSpanType> = [];

  const remainingRegressionChildren = [...regressionChildren];

  for (const baselineSpan of baseChildren) {
    // reduce remainingRegressionChildren down to spans that are applicable candidate
    // of spans that can be paired with baselineSpan

    const candidates = remainingRegressionChildren.reduce(
      (
        acc: Array<{regressionSpan: SpanType; index: number; matchScore: number}>,
        regressionSpan: SpanType,
        index: number
      ) => {
        const matchScore = matchableSpans({baselineSpan, regressionSpan});
        if (matchScore !== 0) {
          acc.push({
            regressionSpan,
            index,
            matchScore,
          });
        }

        return acc;
      },
      []
    );

    if (candidates.length === 0) {
      children.push({
        comparisonResult: 'baseline',
        baselineSpan,
      });
      continue;
    }

    // the best candidate span is one that has the closest start timestamp to baselineSpan;
    // and one that has a duration that's close to baselineSpan

    const baselineSpanDuration = Math.abs(
      baselineSpan.timestamp - baselineSpan.start_timestamp
    );

    const {regressionSpan, index} = candidates.reduce((bestCandidate, nextCandidate) => {
      const {regressionSpan: thisSpan, matchScore: thisSpanMatchScore} = bestCandidate;
      const {regressionSpan: otherSpan, matchScore: otherSpanMatchScore} = nextCandidate;

      // calculate the deltas of the start timestamps relative to baselineSpan's
      // start timestamp

      const deltaStartTimestampThisSpan = Math.abs(
        thisSpan.start_timestamp - baselineSpan.start_timestamp
      );

      const deltaStartTimestampOtherSpan = Math.abs(
        otherSpan.start_timestamp - baselineSpan.start_timestamp
      );

      // calculate the deltas of the durations relative to the baselineSpan's
      // duration

      const thisSpanDuration = Math.abs(thisSpan.timestamp - thisSpan.start_timestamp);
      const otherSpanDuration = Math.abs(otherSpan.timestamp - otherSpan.start_timestamp);

      const deltaDurationThisSpan = Math.abs(thisSpanDuration - baselineSpanDuration);
      const deltaDurationOtherSpan = Math.abs(otherSpanDuration - baselineSpanDuration);

      const thisSpanScore =
        deltaDurationThisSpan + deltaStartTimestampThisSpan + (1 - thisSpanMatchScore);

      const otherSpanScore =
        deltaDurationOtherSpan + deltaStartTimestampOtherSpan + (1 - otherSpanMatchScore);

      if (thisSpanScore < otherSpanScore) {
        return bestCandidate;
      }

      if (thisSpanScore > otherSpanScore) {
        return nextCandidate;
      }

      return bestCandidate;
    });

    // remove regressionSpan from list of remainingRegressionChildren
    remainingRegressionChildren.splice(index, 1);

    comparablePairs.push({
      type: 'descendent',
      parent_span_id,
      baselineSpan,
      regressionSpan,
    });

    children.push({
      comparisonResult: 'matched',
      span_id: generateMergedSpanId({baselineSpan, regressionSpan}),
      op: baselineSpan.op,
      description: baselineSpan.description,
      baselineSpan,
      regressionSpan,
    });
  }

  // push any remaining un-matched regressionSpans
  for (const regressionSpan of remainingRegressionChildren) {
    children.push({
      comparisonResult: 'regression',
      regressionSpan,
    });
  }

  // sort children by most time added

  children.sort(sortByMostTimeAdded);

  return {
    comparablePairs,
    children,
  };
}

function jaroSimilarity(thisString: string, otherString: string): number {
  // based on https://winkjs.org/wink-distance/string-jaro-winkler.js.html
  // and https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance
  if (thisString === otherString) {
    return 1;
  }

  let jaroDistance: number = jaro(thisString, otherString).distance;

  // Constant scaling factor for how much the score is adjusted upwards for having common prefixes.
  // This is only used for the Jaro–Winkler Similarity procedure.
  const scalingFactor = 0.1;

  // boostThreshold is the upper bound threshold of which if the Jaro score was less-than or equal
  // to boostThreshold, then the Jaro–Winkler Similarity procedure is applied. Otherwise,
  // 1 - jaroDistance is returned.
  const boostThreshold = 0.3;

  if (jaroDistance > boostThreshold) {
    return 1 - jaroDistance;
  }

  const pLimit = Math.min(thisString.length, otherString.length, 4);
  let l = 0;

  for (let i = 0; i < pLimit; i += 1) {
    if (thisString[i] === otherString[i]) {
      l += 1;
    } else {
      break;
    }
  }

  jaroDistance -= l * scalingFactor * jaroDistance;
  return 1 - jaroDistance;
}

function matchableSpans({
  baselineSpan,
  regressionSpan,
}: {
  baselineSpan: SpanType;
  regressionSpan: SpanType;
}): number {
  const opNamesEqual = baselineSpan.op === regressionSpan.op;

  if (!opNamesEqual) {
    return 0;
  }

  // remove whitespace and convert string to lower case as the individual characters
  // adds noise to the edit distance function
  const baselineDescription = (baselineSpan.description || '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const regressionDescription = (regressionSpan.description || '')
    .replace(/\s+/g, '')
    .toLowerCase();

  const score = jaroSimilarity(baselineDescription, regressionDescription);

  return score >= COMMON_SIMILARITY_DESCRIPTION_THRESHOLD ? score : 0;
}

function generateMergedSpanId({
  baselineSpan,
  regressionSpan,
}: {
  baselineSpan: SpanType;
  regressionSpan: SpanType;
}): string {
  return `${baselineSpan.span_id}${regressionSpan.span_id}`;
}

function getDiffSpanDuration(diffSpan: DiffSpanType): number {
  switch (diffSpan.comparisonResult) {
    case 'matched': {
      return Math.max(
        getSpanDuration(diffSpan.baselineSpan),
        getSpanDuration(diffSpan.regressionSpan)
      );
    }
    case 'baseline': {
      return getSpanDuration(diffSpan.baselineSpan);
    }
    case 'regression': {
      return getSpanDuration(diffSpan.regressionSpan);
    }
    default: {
      throw Error('Unknown comparisonResult');
    }
  }
}

export function getSpanDuration(span: RawSpanType): number {
  return Math.abs(span.timestamp - span.start_timestamp);
}

function getMatchedSpanDurationDeltas({
  baselineSpan,
  regressionSpan,
}: {
  baselineSpan: RawSpanType;
  regressionSpan: RawSpanType;
}): number {
  return getSpanDuration(regressionSpan) - getSpanDuration(baselineSpan);
}

function sortDiffSpansByDuration(
  firstSpan: DiffSpanType,
  secondSpan: DiffSpanType
): number {
  const firstSpanDuration = getDiffSpanDuration(firstSpan);
  const secondSpanDuration = getDiffSpanDuration(secondSpan);

  if (firstSpanDuration > secondSpanDuration) {
    // sort firstSpan before secondSpan
    return -1;
  }

  if (firstSpanDuration < secondSpanDuration) {
    // sort secondSpan before firstSpan
    return 1;
  }

  return 0;
}

function sortSpans(firstSpan: RawSpanType, secondSpan: RawSpanType): number {
  const firstSpanDuration = getSpanDuration(firstSpan);
  const secondSpanDuration = getSpanDuration(secondSpan);

  if (firstSpanDuration > secondSpanDuration) {
    // sort firstSpan before secondSpan
    return -1;
  }

  if (firstSpanDuration < secondSpanDuration) {
    // sort secondSpan before firstSpan
    return 1;
  }

  // try to break ties by sorting by start timestamp in ascending order

  if (firstSpan.start_timestamp < secondSpan.start_timestamp) {
    // sort firstSpan before secondSpan
    return -1;
  }

  if (firstSpan.start_timestamp > secondSpan.start_timestamp) {
    // sort secondSpan before firstSpan
    return 1;
  }

  return 0;
}

function sortByMostTimeAdded(firstSpan: DiffSpanType, secondSpan: DiffSpanType): number {
  // Sort the spans by most time added. This means that when comparing the spans of the regression transaction
  // against the spans of the baseline transaction, we sort the spans by those that have regressed the most
  // relative to their baseline counter parts first.
  //
  // In terms of sort, we display them in the following way:
  // - Regression only spans; sorted first by duration (descending), and then start timestamps (ascending)
  // - Matched spans:
  //     - slower -- i.e. regression.duration - baseline.duration > 0 (sorted by duration deltas, and by duration)
  //     - no change -- i.e. regression.duration - baseline.duration == 0 (sorted by duration)
  //     - faster -- i.e. regression.duration - baseline.duration < 0 (sorted by duration deltas, and by duration)
  // - Baseline only spans; sorted by duration

  switch (firstSpan.comparisonResult) {
    case 'regression': {
      switch (secondSpan.comparisonResult) {
        case 'regression': {
          return sortSpans(firstSpan.regressionSpan, secondSpan.regressionSpan);
        }
        case 'baseline':
        case 'matched': {
          // sort firstSpan (regression) before secondSpan (baseline)
          return -1;
        }
        default: {
          throw Error('Unknown comparisonResult');
        }
      }
    }
    case 'baseline': {
      switch (secondSpan.comparisonResult) {
        case 'baseline': {
          return sortSpans(firstSpan.baselineSpan, secondSpan.baselineSpan);
        }
        case 'regression':
        case 'matched': {
          // sort secondSpan (regression or matched) before firstSpan (baseline)
          return 1;
        }
        default: {
          throw Error('Unknown comparisonResult');
        }
      }
    }
    case 'matched': {
      switch (secondSpan.comparisonResult) {
        case 'regression': {
          // sort secondSpan (regression) before firstSpan (matched)
          return 1;
        }
        case 'baseline': {
          // sort firstSpan (matched) before secondSpan (baseline)
          return -1;
        }
        case 'matched': {
          const firstSpanDurationDelta = getMatchedSpanDurationDeltas({
            regressionSpan: firstSpan.regressionSpan,
            baselineSpan: firstSpan.baselineSpan,
          });

          const secondSpanDurationDelta = getMatchedSpanDurationDeltas({
            regressionSpan: secondSpan.regressionSpan,
            baselineSpan: secondSpan.baselineSpan,
          });

          if (firstSpanDurationDelta > 0) {
            // firstSpan has slower regression span relative to the baseline span
            if (secondSpanDurationDelta > 0) {
              // secondSpan has slower regression span relative to the baseline span
              if (firstSpanDurationDelta > secondSpanDurationDelta) {
                // sort firstSpan before secondSpan
                return -1;
              }

              if (firstSpanDurationDelta < secondSpanDurationDelta) {
                // sort secondSpan before firstSpan
                return 1;
              }

              return sortDiffSpansByDuration(firstSpan, secondSpan);
            }

            // case: secondSpan is either "no change" or "faster"

            // sort firstSpan before secondSpan
            return -1;
          }

          if (firstSpanDurationDelta === 0) {
            // firstSpan has a regression span relative that didn't change relative to the baseline span

            if (secondSpanDurationDelta > 0) {
              // secondSpan has slower regression span relative to the baseline span

              // sort secondSpan before firstSpan
              return 1;
            }

            if (secondSpanDurationDelta < 0) {
              // faster
              // sort firstSpan before secondSpan
              return -1;
            }

            // secondSpan has a regression span relative that didn't change relative to the baseline span
            return sortDiffSpansByDuration(firstSpan, secondSpan);
          }

          // case: firstSpanDurationDelta < 0

          if (secondSpanDurationDelta >= 0) {
            // either secondSpan has slower regression span relative to the baseline span,
            // or the secondSpan has a regression span relative that didn't change relative to the baseline span

            // sort secondSpan before firstSpan
            return 1;
          }

          // case: secondSpanDurationDelta < 0

          if (firstSpanDurationDelta < secondSpanDurationDelta) {
            // sort firstSpan before secondSpan
            return -1;
          }

          if (firstSpanDurationDelta > secondSpanDurationDelta) {
            // sort secondSpan before firstSpan
            return 1;
          }

          return sortDiffSpansByDuration(firstSpan, secondSpan);
        }
        default: {
          throw Error('Unknown comparisonResult');
        }
      }
    }
    default: {
      throw Error('Unknown comparisonResult');
    }
  }
}

export function getSpanID(diffSpan: DiffSpanType): string {
  switch (diffSpan.comparisonResult) {
    case 'matched': {
      return diffSpan.span_id;
    }
    case 'baseline': {
      return diffSpan.baselineSpan.span_id;
    }
    case 'regression': {
      return diffSpan.regressionSpan.span_id;
    }
    default: {
      throw Error('Unknown comparisonResult');
    }
  }
}

export function getSpanOperation(diffSpan: DiffSpanType): string | undefined {
  switch (diffSpan.comparisonResult) {
    case 'matched': {
      return diffSpan.op;
    }
    case 'baseline': {
      return diffSpan.baselineSpan.op;
    }
    case 'regression': {
      return diffSpan.regressionSpan.op;
    }
    default: {
      throw Error('Unknown comparisonResult');
    }
  }
}

export function getSpanDescription(diffSpan: DiffSpanType): string | undefined {
  switch (diffSpan.comparisonResult) {
    case 'matched': {
      return diffSpan.description;
    }
    case 'baseline': {
      return diffSpan.baselineSpan.description;
    }
    case 'regression': {
      return diffSpan.regressionSpan.description;
    }
    default: {
      throw Error('Unknown comparisonResult');
    }
  }
}

export function isOrphanDiffSpan(diffSpan: DiffSpanType): boolean {
  switch (diffSpan.comparisonResult) {
    case 'matched': {
      return isOrphanSpan(diffSpan.baselineSpan) || isOrphanSpan(diffSpan.regressionSpan);
    }
    case 'baseline': {
      return isOrphanSpan(diffSpan.baselineSpan);
    }
    case 'regression': {
      return isOrphanSpan(diffSpan.regressionSpan);
    }
    default: {
      throw Error('Unknown comparisonResult');
    }
  }
}

export type SpanWidths =
  | {
      type: 'WIDTH_PIXEL';
      width: 1;
    }
  | {
      type: 'WIDTH_PERCENTAGE';
      width: number;
    };

export type SpanGeneratedBoundsType = {
  background: SpanWidths;
  foreground: SpanWidths | undefined;
  baseline: SpanWidths | undefined;
  regression: SpanWidths | undefined;
};

function generateWidth({
  duration,
  largestDuration,
}: {
  duration: number;
  largestDuration: number;
}): SpanWidths {
  if (duration <= 0) {
    return {
      type: 'WIDTH_PIXEL',
      width: 1,
    };
  }

  return {
    type: 'WIDTH_PERCENTAGE',
    width: duration / largestDuration,
  };
}

export function boundsGenerator(rootSpans: Array<DiffSpanType>) {
  // get largest duration among the root spans.
  // invariant: this is the largest duration among all of the spans on the transaction
  //            comparison page.
  const largestDuration = Math.max(
    ...rootSpans.map(rootSpan => {
      return getDiffSpanDuration(rootSpan);
    })
  );

  return (span: DiffSpanType): SpanGeneratedBoundsType => {
    switch (span.comparisonResult) {
      case 'matched': {
        const baselineDuration = getSpanDuration(span.baselineSpan);
        const regressionDuration = getSpanDuration(span.regressionSpan);

        const baselineWidth = generateWidth({
          duration: baselineDuration,
          largestDuration,
        });
        const regressionWidth = generateWidth({
          duration: regressionDuration,
          largestDuration,
        });

        if (baselineDuration >= regressionDuration) {
          return {
            background: baselineWidth,
            foreground: regressionWidth,
            baseline: baselineWidth,
            regression: regressionWidth,
          };
        }

        // case: baselineDuration < regressionDuration
        return {
          background: regressionWidth,
          foreground: baselineWidth,
          baseline: baselineWidth,
          regression: regressionWidth,
        };
      }
      case 'regression': {
        const regressionDuration = getSpanDuration(span.regressionSpan);

        const regressionWidth = generateWidth({
          duration: regressionDuration,
          largestDuration,
        });

        return {
          background: regressionWidth,
          foreground: undefined,
          baseline: undefined,
          regression: regressionWidth,
        };
      }
      case 'baseline': {
        const baselineDuration = getSpanDuration(span.baselineSpan);

        const baselineWidth = generateWidth({
          duration: baselineDuration,
          largestDuration,
        });

        return {
          background: baselineWidth,
          foreground: undefined,
          baseline: baselineWidth,
          regression: undefined,
        };
      }
      default: {
        const _exhaustiveCheck: never = span;
        return _exhaustiveCheck;
      }
    }
  };
}

export function generateCSSWidth(width: SpanWidths | undefined): string | undefined {
  if (!width) {
    return undefined;
  }

  switch (width.type) {
    case 'WIDTH_PIXEL': {
      return `${width.width}px`;
    }
    case 'WIDTH_PERCENTAGE': {
      return toPercent(width.width);
    }
    default: {
      const _exhaustiveCheck: never = width;
      return _exhaustiveCheck;
    }
  }
}
