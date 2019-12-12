import React from 'react';
import get from 'lodash/get';

import {t} from 'app/locale';
import {Event} from 'app/types';
import {
  SentryTransactionEvent,
  SpanEntry,
  SpanType,
} from 'app/components/events/interfaces/spans/types';

type EventBreakdownType = {
  ops: {name: string; count: number; percentage: number; duration: number}[];
  unknown: {count: number; percentage: number; duration: number} | undefined;
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

  generateCounts(): EventBreakdownType {
    const event = this.getTransactionEvent();

    if (!event) {
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
    const spansWithNoOperation = {count: 0, duration: 0};

    const numOfSpans = spans.length;

    type AggregateType = {
      [opname: string]: {
        count: number;
        duration: number; // num of seconds
      };
    };

    const aggregateByOp: AggregateType = spans.reduce(
      (aggregate: AggregateType, span: SpanType) => {
        const op = span.op;
        const duration = Math.abs(span.timestamp - span.start_timestamp);

        if (typeof op !== 'string') {
          spansWithNoOperation.count += 1;
          spansWithNoOperation.duration += duration;

          return aggregate;
        }
        const opStats = aggregate[op];

        if (!opStats) {
          aggregate[op] = {
            count: 1,
            duration,
          };
          return aggregate;
        }

        aggregate[op].count += 1;
        aggregate[op].duration += duration;

        return aggregate;
      },
      {}
    );

    const ops = Object.keys(aggregateByOp).map(opName => {
      return {
        name: opName,
        count: aggregateByOp[opName].count,
        percentage: aggregateByOp[opName].count / numOfSpans,
        duration: aggregateByOp[opName].duration,
      };
    });

    // sort ops by most frequently ocurring to least frequently ocurring
    ops.sort((firstOp, secondOp) => {
      // sort in descending order based on count

      if (firstOp.count === secondOp.count) {
        return 0;
      }

      if (firstOp.count > secondOp.count) {
        return -1;
      }

      return 1;
    });

    return {
      // use the first 3 most frequently occurring ops
      ops: ops.slice(0, 4),
      unknown:
        spansWithNoOperation.count > 0
          ? {
              count: spansWithNoOperation.count,
              percentage: spansWithNoOperation.count / numOfSpans,
              duration: spansWithNoOperation.duration,
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
