import type {fullSnapshotEvent, serializedNodeWithId} from 'sentry/utils/replays/types';
import {EventType, NodeType} from 'sentry/utils/replays/types';

interface FullSnapshotEvent extends fullSnapshotEvent {
  timestamp: number;
}

const nextRRWebId = (function () {
  let __rrwebID = 0;
  return () => ++__rrwebID;
})();

export function RRWebInitFrameEvents({
  height = 600,
  href = 'http://localhost/',
  timestamp,
  width = 800,
}: {
  timestamp: Date;
  height?: number;
  href?: string;
  width?: number;
}) {
  return [
    {
      type: EventType.DomContentLoaded,
      timestamp: timestamp.getTime(), // rrweb timestamps are in ms
    },
    {
      type: EventType.Load,
      timestamp: timestamp.getTime(), // rrweb timestamps are in ms
    },
    {
      type: EventType.Meta,
      data: {href, width, height},
      timestamp: timestamp.getTime(), // rrweb timestamps are in ms
    },
  ];
}

export function RRWebFullSnapshotFrameEvent({
  timestamp,
  childNodes = [],
}: {
  timestamp: Date;
  childNodes?: serializedNodeWithId[];
}): FullSnapshotEvent {
  return {
    type: EventType.FullSnapshot,
    timestamp: timestamp.getTime(),
    data: {
      initialOffset: {top: 0, left: 0},
      node: {
        type: NodeType.Document,
        id: 0,
        childNodes: [
          RRWebDOMFrame({
            tagName: 'body',
            attributes: {
              style:
                'margin:0; font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu;',
            },
            childNodes,
          }),
        ],
      },
    },
  };
}

export function RRWebDOMFrame({
  id,
  tagName,
  attributes,
  childNodes,
  textContent,
}: {
  attributes?: Record<string, string>;
  childNodes?: serializedNodeWithId[];
  id?: number;
  tagName?: string;
  textContent?: string;
}): serializedNodeWithId {
  id = id ?? nextRRWebId();
  if (tagName) {
    return {
      type: NodeType.Element,
      id,
      tagName,
      attributes: attributes ?? {},
      childNodes: childNodes ?? [],
    };
  }
  return {
    type: NodeType.Text,
    id,
    textContent: textContent ?? '',
  };
}

export function RRWebHelloWorldFrame() {
  return RRWebDOMFrame({
    tagName: 'div',
    childNodes: [
      RRWebDOMFrame({
        tagName: 'h1',
        attributes: {style: 'text-align: center;'},
        childNodes: [
          RRWebDOMFrame({
            textContent: 'Hello World',
          }),
        ],
      }),
    ],
  });
}
