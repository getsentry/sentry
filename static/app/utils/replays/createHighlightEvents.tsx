import type {eventWithTime} from 'rrweb/typings/types';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';

export default function createHighlightEvents(entries: RawSpanType[]): eventWithTime[] {
  return entries
    .filter(({op, data}) => op === 'largest-contentful-paint' && data?.nodeId > 0)
    .map(({start_timestamp, data: {nodeId}}) => ({
      type: 6, // plugin type
      data: {
        nodeId,
        text: 'LCP',
      },
      timestamp: Math.floor(start_timestamp * 1000),
    }));
}
