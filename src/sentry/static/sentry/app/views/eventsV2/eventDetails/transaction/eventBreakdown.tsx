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
    let unknown = 0;

    const foo: {[key: string]: number} = spans.reduce((lookup, span: SpanType) => {
      const op = span.op;

      if (typeof op === 'string') {
        const count = lookup[op];
        if (!count) {
          lookup[op] = 1;
          return lookup;
        }

        lookup[op] = count + 1;

        return lookup;
      }

      unknown += 1;

      return lookup;
    }, {});

    return {lookup: foo, unknown};
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
        {Object.keys(results.lookup).map(key => {
          return (
            <div>
              {key} - {(results.lookup[key] / total) * 100}%
            </div>
          );
        })}
      </div>
    );
  }
}

export default EventBreakdown;
