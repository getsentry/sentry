import React from 'react';
import get from 'lodash/get';

import {Event} from 'app/types';
import {
  SentryTransactionEvent,
  SpanEntry,
  SpanType,
} from 'app/components/events/interfaces/spans/types';

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

  generateCounts(spans: SpanType[]) {
    // track number of spans with no operation
    let numOfSpansWithNoOperations = 0;

    const opCounter: {[key: string]: number} = spans.reduce((counter, span: SpanType) => {
      const op = span.op;

      if (typeof op !== 'string') {
        numOfSpansWithNoOperations += 1;
        return counter;
      }

      const count = counter[op];
      if (!count) {
        counter[op] = 1;
        return counter;
      }

      counter[op] = count + 1;

      return counter;
    }, {});

    return {opCounter, numOfSpansWithNoOperations};
  }

  render() {
    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }
    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    const spans: SpanType[] = get(spanEntry, 'data', []);

    const results = this.generateCounts(spans);
    console.log('generateCounts');

    const total = spans.length;

    return (
      <div>
        <strong>EventBreakdown</strong>
        {Object.keys(results.opCounter).map(key => {
          return (
            <div>
              {key} - {(results.opCounter[key] / total) * 100}%
            </div>
          );
        })}
      </div>
    );
  }
}

export default EventBreakdown;
