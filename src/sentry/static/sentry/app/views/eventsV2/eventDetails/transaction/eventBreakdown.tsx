import React from 'react';
import get from 'lodash/get';

import {Event} from 'app/types';
import {
  SentryTransactionEvent,
  SpanEntry,
  SpanType,
} from 'app/components/events/interfaces/spans/types';
import {TraceContextType} from 'app/components/events/interfaces/spans/traceView';

type OpStats = {percentage: number; totalDuration: number};

type EventBreakdownType = {
  ops: ({name: string} & OpStats)[];
  unknown: OpStats | undefined;
};

type Props = {
  event: Event;
};

class EventBreakdown extends React.Component<Props> {
  getTransactionEvent(): SentryTransactionEvent | undefined {
    const {event} = this.props;

    if (event.type === 'transaction') {
      return event as SentryTransactionEvent;
    }

    return undefined;
  }

  generateStats(): EventBreakdownType {
    const event = this.getTransactionEvent();

    if (!event) {
      return {
        ops: [],
        unknown: undefined,
      };
    }

    const traceContext: TraceContextType | undefined = get(event, 'contexts.trace');

    if (!traceContext) {
      return {
        ops: [],
        unknown: undefined,
      };
    }

    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    const spans: SpanType[] = get(spanEntry, 'data', []);

    // track stats on spans with no operation
    const spansWithNoOperation = {count: 0, totalDuration: 0};

    type AggregateType = {
      [opname: string]: {
        totalDuration: number; // num of seconds
      };
    };

    const totalDuration = Math.abs(event.endTimestamp - event.startTimestamp);

    spans.push({
      op: traceContext.op,
      timestamp: event.endTimestamp,
      start_timestamp: event.startTimestamp,
      trace_id: traceContext.trace_id || '',
      span_id: traceContext.span_id || '',
      data: {},
    });

    const aggregateByOp: AggregateType = spans.reduce(
      (aggregate: AggregateType, span: SpanType) => {
        const op = span.op;
        const duration = Math.abs(span.timestamp - span.start_timestamp);

        if (typeof op !== 'string') {
          spansWithNoOperation.count += 1;
          spansWithNoOperation.totalDuration += duration;

          return aggregate;
        }
        const opStats = aggregate[op];

        if (!opStats) {
          aggregate[op] = {
            totalDuration: duration,
          };
          return aggregate;
        }

        aggregate[op].totalDuration += duration;

        return aggregate;
      },
      {}
    );

    const ops = Object.keys(aggregateByOp).map(opName => {
      return {
        name: opName,
        percentage: aggregateByOp[opName].totalDuration / totalDuration,
        totalDuration: aggregateByOp[opName].totalDuration,
      };
    });

    ops.sort((firstOp, secondOp) => {
      // sort in descending order based on total duration

      if (firstOp.percentage === secondOp.percentage) {
        return 0;
      }

      if (firstOp.percentage > secondOp.percentage) {
        return -1;
      }

      return 1;
    });

    return {
      // use the first 4 ops with the top total duration
      ops: ops.slice(0, 4),
      unknown:
        spansWithNoOperation.count > 0
          ? {
              percentage: spansWithNoOperation.count / totalDuration,
              totalDuration: spansWithNoOperation.totalDuration,
            }
          : undefined,
    };
  }

  render() {
    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }

    // TODO: Dora to take over
    // const results = this.generateCounts();

    return null;
  }
}

export default EventBreakdown;
