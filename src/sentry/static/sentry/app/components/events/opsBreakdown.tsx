import React from 'react';
import styled from '@emotion/styled';
import isFinite from 'lodash/isFinite';

import {Event, SentryTransactionEvent} from 'app/types';
import {
  SpanEntry,
  RawSpanType,
  TraceContextType,
} from 'app/components/events/interfaces/spans/types';
import QuestionTooltip from 'app/components/questionTooltip';
import {SectionHeading} from 'app/components/charts/styles';
import {pickSpanBarColour} from 'app/components/events/interfaces/spans/utils';
import {t} from 'app/locale';
import space from 'app/styles/space';

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
  event: Event;
};

class OpsBreakdown extends React.Component<Props> {
  getTransactionEvent(): SentryTransactionEvent | undefined {
    const {event} = this.props;

    if (event.type === 'transaction') {
      return event as SentryTransactionEvent;
    }

    return undefined;
  }

  generateStats(): OpBreakdownType {
    const event = this.getTransactionEvent();

    if (!event) {
      return [];
    }

    const traceContext: TraceContextType | undefined = event?.contexts?.trace;

    if (!traceContext) {
      return [];
    }

    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    let spans: RawSpanType[] = spanEntry?.data ?? [];

    spans =
      spans.length > 0
        ? spans
        : // if there are no descendent spans, then use the transaction root span
          [
            {
              op: traceContext.op,
              timestamp: event.endTimestamp,
              start_timestamp: event.startTimestamp,
              trace_id: traceContext.trace_id || '',
              span_id: traceContext.span_id || '',
              data: {},
            },
          ];

    const operationNameIntervals = spans.reduce(
      (intervals: Partial<OperationNameIntervals>, span: RawSpanType) => {
        let startTimestamp = span.start_timestamp;
        let endTimestamp = span.timestamp;

        if (endTimestamp < startTimestamp) {
          // reverse timestamps
          startTimestamp = span.timestamp;
          endTimestamp = span.start_timestamp;
        }

        // invariant: startTimestamp <= endTimestamp

        let operationName = span.op;

        if (typeof operationName !== 'string') {
          // a span with no operation name is considered an 'unknown' op
          operationName = 'unknown';
        }

        const cover: TimeWindowSpan = [startTimestamp, endTimestamp];

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

    const breakdown = sortedOpsBreakdown.slice(0, TOP_N_SPANS).map(
      ([operationName, duration]: [OperationName, Duration]): OpStats => {
        return {
          name: operationName,
          // percentage to be recalculated after the ops breakdown group is decided
          percentage: 0,
          totalInterval: duration,
        };
      }
    );

    const other = sortedOpsBreakdown.slice(TOP_N_SPANS).reduce(
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

  render() {
    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }

    const breakdown = this.generateStats();

    return (
      <StyledBreakdown>
        <BreakdownHeader>
          <SectionHeading>{t('Operation Breakdown')}</SectionHeading>
          <QuestionTooltip
            position="top"
            size="sm"
            containerDisplayMode="block"
            title={t(
              'Durations are calculated by summing span durations over the course of the transaction. Percentages are then calculated by dividing the individual op duration by the sum of total op durations. Overlapping/parallel spans are only counted once.'
            )}
          />
        </BreakdownHeader>
        {breakdown.map(currOp => {
          const {name, percentage, totalInterval} = currOp;

          const isOther = name === OtherOperation;
          const operationName = typeof name === 'string' ? name : t('Other');

          const durLabel = Math.round(totalInterval * 1000 * 100) / 100;
          const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';
          const opsColor: string = pickSpanBarColour(operationName);

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
        })}
      </StyledBreakdown>
    );
  }
}

const StyledBreakdown = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const OpsLine = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};

  * + * {
    margin-left: ${space(0.5)};
  }
`;

const OpsDot = styled('div')`
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
  color: ${p => p.theme.gray500};
`;

const Pct = styled('div')`
  min-width: 40px;
  text-align: right;
`;

const BreakdownHeader = styled('div')`
  display: flex;
  align-items: center;
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
