import styled from '@emotion/styled';
import isFinite from 'lodash/isFinite';

import {SectionHeading} from 'sentry/components/charts/styles';
import {ActiveOperationFilter} from 'sentry/components/events/interfaces/spans/filter';
import {
  RawSpanType,
  TraceContextType,
} from 'sentry/components/events/interfaces/spans/types';
import {getSpanOperation} from 'sentry/components/events/interfaces/spans/utils';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  AggregateEventTransaction,
  EntrySpans,
  EntryType,
  Event,
  EventTransaction,
} from 'sentry/types/event';

type StartTimestamp = number;
type EndTimestamp = number;
type Duration = number;

type TimeWindowSpan = [StartTimestamp, EndTimestamp];

const OtherOperation = Symbol('Other');

type OperationName = string | typeof OtherOperation;

// mapping an operation name to a disjoint set of time intervals (start/end timestamp).
// this is an intermediary data structure to help calculate the coverage of an operation name
// with respect to the root transaction span's operation lifetime
type OperationNameIntervals = Record<OperationName, Array<TimeWindowSpan>>;
type OperationNameCoverage = Record<OperationName, Duration>;

type OpStats = {
  name: OperationName;
  percentage: number;
  totalInterval: number;
};

const TOP_N_SPANS = 4;

type OpBreakdownType = OpStats[];

type Props = {
  event: Event | AggregateEventTransaction;
  operationNameFilters: ActiveOperationFilter;
  hideHeader?: boolean;
  topN?: number;
};

export function generateStats(
  transactionEvent: EventTransaction | AggregateEventTransaction,
  operationNameFilters: ActiveOperationFilter,
  topN?: number
): OpBreakdownType {
  if (!transactionEvent) {
    return [];
  }

  const traceContext: TraceContextType | undefined = transactionEvent?.contexts?.trace;

  if (!traceContext) {
    return [];
  }

  const spanEntry = transactionEvent.entries.find(
    (entry: EntrySpans | any): entry is EntrySpans => {
      return entry.type === EntryType.SPANS;
    }
  );

  let spans: RawSpanType[] = spanEntry?.data ?? [];

  const rootSpan = {
    op: traceContext.op,
    timestamp: transactionEvent.endTimestamp,
    start_timestamp: transactionEvent.startTimestamp,
    trace_id: traceContext.trace_id || '',
    span_id: traceContext.span_id || '',
    data: {},
  };

  spans =
    spans.length > 0
      ? spans
      : // if there are no descendent spans, then use the transaction root span
        [rootSpan];

  // Filter spans by operation name
  if (operationNameFilters.type === 'active_filter') {
    spans = [...spans, rootSpan];
    spans = spans.filter(span => {
      const operationName = getSpanOperation(span);

      const shouldFilterOut =
        typeof operationName === 'string' &&
        !operationNameFilters.operationNames.has(operationName);

      return !shouldFilterOut;
    });
  }

  const operationNameIntervals = spans.reduce(
    (intervals: Partial<OperationNameIntervals>, span: RawSpanType) => {
      let startTimestamp = span.start_timestamp;
      const endTimestamp = span.timestamp;

      if (!span.exclusive_time) {
        return intervals;
      }

      if (endTimestamp < startTimestamp) {
        // reverse timestamps
        startTimestamp = span.timestamp;
      }

      // invariant: startTimestamp <= endTimestamp

      let operationName = span.op;

      if (typeof operationName !== 'string') {
        // a span with no operation name is considered an 'unknown' op
        operationName = 'unknown';
      }

      const cover: TimeWindowSpan = [
        startTimestamp,
        startTimestamp + span.exclusive_time / 1000,
      ];

      const operationNameInterval = intervals[operationName];

      if (!Array.isArray(operationNameInterval)) {
        intervals[operationName] = [cover];

        return intervals;
      }

      operationNameInterval.push(cover);

      intervals[operationName] = mergeInterval(operationNameInterval);

      return intervals;
    },
    {}
  ) as OperationNameIntervals;

  const operationNameCoverage = Object.entries(operationNameIntervals).reduce(
    (
      acc: Partial<OperationNameCoverage>,
      [operationName, intervals]: [OperationName, TimeWindowSpan[]]
    ) => {
      const duration = intervals.reduce((sum: number, [start, end]) => {
        return sum + Math.abs(end - start);
      }, 0);

      acc[operationName] = duration;

      return acc;
    },
    {}
  ) as OperationNameCoverage;

  const sortedOpsBreakdown = Object.entries(operationNameCoverage).sort(
    (first: [OperationName, Duration], second: [OperationName, Duration]) => {
      const firstDuration = first[1];
      const secondDuration = second[1];

      if (firstDuration === secondDuration) {
        return 0;
      }

      if (firstDuration < secondDuration) {
        // sort second before first
        return 1;
      }

      // otherwise, sort first before second
      return -1;
    }
  );

  const breakdown = sortedOpsBreakdown
    .slice(0, topN)
    .map(([operationName, duration]: [OperationName, Duration]): OpStats => {
      return {
        name: operationName,
        // percentage to be recalculated after the ops breakdown group is decided
        percentage: 0,
        totalInterval: duration,
      };
    });

  const other = sortedOpsBreakdown.slice(topN).reduce(
    (accOther: OpStats, [_operationName, duration]: [OperationName, Duration]) => {
      accOther.totalInterval += duration;

      return accOther;
    },
    {
      name: OtherOperation,
      // percentage to be recalculated after the ops breakdown group is decided
      percentage: 0,
      totalInterval: 0,
    }
  );

  if (other.totalInterval > 0) {
    breakdown.push(other);
  }

  // calculate breakdown total duration

  const total = breakdown.reduce((sum: number, operationNameGroup) => {
    return sum + operationNameGroup.totalInterval;
  }, 0);

  // recalculate percentage values

  breakdown.forEach(operationNameGroup => {
    operationNameGroup.percentage = operationNameGroup.totalInterval / total;
  });

  return breakdown;
}

function OpsBreakdown({
  event,
  operationNameFilters,
  hideHeader = false,
  topN = TOP_N_SPANS,
}: Props) {
  const transactionEvent =
    event.type === 'transaction' || event.type === 'aggregateTransaction'
      ? event
      : undefined;

  if (!transactionEvent) {
    return null;
  }

  const breakdown = generateStats(transactionEvent, operationNameFilters, topN);

  const contents = breakdown.map(currOp => {
    const {name, percentage, totalInterval} = currOp;

    const isOther = name === OtherOperation;
    const operationName = typeof name === 'string' ? name : t('Other');

    const durLabel = Math.round(totalInterval * 1000 * 100) / 100;
    const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';
    const opsColor: string = pickBarColor(operationName);

    return (
      <OpsLine key={operationName}>
        <OpsNameContainer>
          <OpsDot style={{backgroundColor: isOther ? 'transparent' : opsColor}} />
          <OpsName>{operationName}</OpsName>
        </OpsNameContainer>
        <OpsContent>
          <Dur>{durLabel}ms</Dur>
          <Pct>{pctLabel}%</Pct>
        </OpsContent>
      </OpsLine>
    );
  });

  if (!hideHeader) {
    return (
      <StyledBreakdown>
        <SectionHeading>
          {t('Operation Breakdown')}
          <QuestionTooltip
            position="top"
            size="sm"
            containerDisplayMode="block"
            title={t(
              'Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once. Percentages are calculated by dividing the summed span durations by the total of all span durations.'
            )}
          />
        </SectionHeading>
        {contents}
      </StyledBreakdown>
    );
  }

  return <StyledBreakdownNoHeader>{contents}</StyledBreakdownNoHeader>;
}

const StyledBreakdown = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const StyledBreakdownNoHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(2)} ${space(3)};
`;

export const OpsLine = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};

  * + * {
    margin-left: ${space(0.5)};
  }
`;

export const OpsDot = styled('div')`
  content: '';
  display: block;
  width: 8px;
  min-width: 8px;
  height: 8px;
  margin-right: ${space(1)};
  border-radius: 100%;
`;

const OpsContent = styled('div')`
  display: flex;
  align-items: center;
`;

const OpsNameContainer = styled(OpsContent)`
  overflow: hidden;
`;

const OpsName = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Dur = styled('div')`
  color: ${p => p.theme.gray300};
  font-variant-numeric: tabular-nums;
`;

const Pct = styled('div')`
  min-width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

function mergeInterval(intervals: TimeWindowSpan[]): TimeWindowSpan[] {
  // sort intervals by start timestamps
  intervals.sort((first: TimeWindowSpan, second: TimeWindowSpan) => {
    if (first[0] < second[0]) {
      // sort first before second
      return -1;
    }

    if (second[0] < first[0]) {
      // sort second before first
      return 1;
    }

    return 0;
  });

  // array of disjoint intervals
  const merged: TimeWindowSpan[] = [];

  for (const currentInterval of intervals) {
    if (merged.length === 0) {
      merged.push(currentInterval);
      continue;
    }

    const lastInterval = merged[merged.length - 1];
    const lastIntervalEnd = lastInterval[1];

    const [currentIntervalStart, currentIntervalEnd] = currentInterval;

    if (lastIntervalEnd < currentIntervalStart) {
      // if currentInterval does not overlap with lastInterval,
      // then add currentInterval
      merged.push(currentInterval);
      continue;
    }

    // currentInterval and lastInterval overlaps; so we merge these intervals

    // invariant: lastIntervalStart <= currentIntervalStart

    lastInterval[1] = Math.max(lastIntervalEnd, currentIntervalEnd);
  }

  return merged;
}

export default OpsBreakdown;
