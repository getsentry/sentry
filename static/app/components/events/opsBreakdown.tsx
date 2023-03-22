import {Component} from 'react';
import styled from '@emotion/styled';
import isFinite from 'lodash/isFinite';

import {SectionHeading} from 'sentry/components/charts/styles';
import {ActiveOperationFilter} from 'sentry/components/events/interfaces/spans/filter';
import {
  EnhancedProcessedSpanType,
  RawSpanType,
  TraceContextType,
} from 'sentry/components/events/interfaces/spans/types';
import {getSpanOperation} from 'sentry/components/events/interfaces/spans/utils';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntrySpans, EntryType, Event, EventTransaction} from 'sentry/types/event';

type StartTimestamp = number;
type EndTimestamp = number;
type Duration = number;

type TimeWindowSpan = [StartTimestamp, EndTimestamp];

const OtherOperation = Symbol('Other');

type OperationName = string | typeof OtherOperation;

const OVERLAP_TIME_NETWORK = true;

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

const TOP_N_SPANS = 5;

type OpBreakdownType = OpStats[];

type DefaultProps = {
  hideHeader: boolean;
  topN: number;
};

type Props = DefaultProps & {
  event: Event;
  operationNameFilters: ActiveOperationFilter;
  spans: EnhancedProcessedSpanType[];
};

const FRONTEND = 'Frontend';
const BACKEND = 'Backend';
const CACHE = 'Cache';
const NETWORK = 'Network';
const DATABASE = 'Database';
const THIRDPARTY = '3rd Party';

class OpsBreakdown extends Component<Props> {
  static defaultProps: DefaultProps = {
    topN: TOP_N_SPANS,
    hideHeader: false,
  };

  getTransactionEvent(): EventTransaction | undefined {
    const {event} = this.props;

    if (event.type === 'transaction') {
      return event as EventTransaction;
    }

    return undefined;
  }

  generateStats(): OpBreakdownType {
    const {topN, operationNameFilters} = this.props;
    const event = this.getTransactionEvent();

    if (!event) {
      return [];
    }

    const traceContext: TraceContextType | undefined = event?.contexts?.trace;

    if (!traceContext) {
      return [];
    }

    // const spanEntry = event.entries.find(
    //   (entry: EntrySpans | any): entry is EntrySpans => {
    //     return entry.type === EntryType.SPANS;
    //   }
    // );

    let spans: EnhancedProcessedSpanType[] = [];

    const rootSpan: any = {
      op: traceContext.op,
      timestamp: event.endTimestamp,
      start_timestamp: event.startTimestamp,
      trace_id: traceContext.trace_id || '',
      span_id: traceContext.span_id || '',
      data: {},
    };

    spans =
      this.props.spans.length > 0
        ? this.props.spans
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
      (intervals: Partial<OperationNameIntervals>, pspan: EnhancedProcessedSpanType) => {
        const span = pspan.span;
        if (!span) {
          return intervals;
        }
        let startTimestamp = span.start_timestamp;
        let endTimestamp = span.timestamp;

        if (!('exclusive_time' in span)) {
          return intervals;
        }

        if (endTimestamp < startTimestamp) {
          // reverse timestamps
          startTimestamp = span.timestamp;
          endTimestamp = span.start_timestamp;
        }

        let duration = (span.exclusive_time ?? 0) / 1000;
        // invariant: startTimestamp <= endTimestamp

        let operationName = span.op;
        if (
          operationName?.startsWith('ui') ||
          operationName?.startsWith('browser') ||
          operationName?.startsWith('resource')
        ) {
          if (operationName !== 'ui.react.render') {
            operationName = FRONTEND;
          }
        } else if (span.data?.type === 'fetch') {
          const childFromFetch = spans.find(
            s =>
              s.span &&
              'op' in s.span &&
              'span_id' in s.span &&
              s.span.parent_span_id === span.span_id
          )?.span;
          if (childFromFetch) {
            // operationName = FRONTEND;
          } else {
            operationName = THIRDPARTY;
          }
        } else if (operationName?.startsWith('http.client')) {
          const childFromFetch = spans.find(
            s =>
              s.span &&
              'op' in s.span &&
              'span_id' in s.span &&
              s.span.parent_span_id === span.span_id
          )?.span;
          if (childFromFetch) {
            return intervals;
          }
          operationName = THIRDPARTY;
        } else if (
          operationName?.includes('django') ||
          operationName?.includes('base') ||
          operationName?.includes('serialize') ||
          operationName?.includes('nodestore') ||
          operationName?.includes('view')
        ) {
          operationName = BACKEND;
        } else if (operationName?.startsWith('db.redis')) {
          operationName = CACHE;
        } else if (operationName === 'db') {
          operationName = DATABASE;
        } else if (typeof operationName !== 'string') {
          // a span with no operation name is considered an 'unknown' op
          operationName = 'unknown';
        } else {
          // return intervals;
        }

        const parentSpanId = span.parent_span_id;
        const parentSpan = spans.find(
          s =>
            s.span &&
            'op' in s.span &&
            'span_id' in s.span &&
            s.span.span_id === parentSpanId &&
            s.span.op === 'http.client'
        )?.span;
        if (parentSpan) {
          let parentSpanStart = parentSpan.start_timestamp;
          let parentSpanEnd = parentSpan.timestamp;
          if (parentSpanEnd < parentSpanStart) {
            // reverse timestamps
            parentSpanStart = parentSpanEnd;
            parentSpanEnd = parentSpan.start_timestamp;
          }
          const parentSpanDuration = parentSpanEnd - parentSpanStart;
          duration = span.timestamp - span.start_timestamp;
          const network = parentSpanDuration - duration;
          const netIntervals = intervals[NETWORK] ?? [];
          const lastIntervalEnd = netIntervals.slice(-1)[0]?.[1] ?? 0;

          // const networkCover: TimeWindowSpan = OVERLAP_TIME_NETWORK
          //   ? [parentSpanStart, parentSpanStart + network]
          //   : [lastIntervalEnd + 1, lastIntervalEnd + 1 + network];
          const networkCover: TimeWindowSpan = OVERLAP_TIME_NETWORK
            ? [0, 0 + network]
            : [lastIntervalEnd + 1, lastIntervalEnd + 1 + network];
          console.log('NETWORK', ...networkCover);

          netIntervals.push(networkCover);
          intervals[NETWORK] = netIntervals;
        }

        const cover: TimeWindowSpan = [startTimestamp, startTimestamp + duration];
        if (
          ![FRONTEND, BACKEND, DATABASE, NETWORK, CACHE, THIRDPARTY].includes(
            operationName
          )
        ) {
          return intervals;
        }

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

  render() {
    const {hideHeader} = this.props;

    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }

    const breakdown = this.generateStats();

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
}

const StyledBreakdown = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const StyledBreakdownNoHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(2)} ${space(3)};
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
