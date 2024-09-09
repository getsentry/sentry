import type {fullSnapshotEvent, incrementalSnapshotEvent, serializedNodeWithId} from 'sentry/utils/replays/types';
import {EventType, NodeType, RecordingFrame} from 'sentry/utils/replays/types';

interface FullSnapshotEvent extends fullSnapshotEvent {
  timestamp: number;
}
interface IncrementalSnapshotEvent extends incrementalSnapshotEvent {
  timestamp: number;
}

const nextRRWebId = (function () {
  let __rrwebID = 0;
  return () => ++__rrwebID;
})();

export function RRWebInitFrameEventsFixture({
  height = 600,
  href = 'http://localhost/',
  timestamp,
  width = 800,
}: {
  timestamp: Date;
  height?: number;
  href?: string;
  width?: number;
}): RecordingFrame[] {
  return [
    {
      type: EventType.DomContentLoaded,
      timestamp: timestamp.getTime(), // rrweb timestamps are in ms
      data: {},
    },
    {
      type: EventType.Load,
      timestamp: timestamp.getTime(), // rrweb timestamps are in ms
      data: {},
    },
    {
      type: EventType.Meta,
      data: {href, width, height},
      timestamp: timestamp.getTime(), // rrweb timestamps are in ms
    },
  ];
}

export function RRWebFullSnapshotFrameEventFixture({
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
          RRWebDOMFrameFixture({
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

export function RRWebIncrementalSnapshotFrameEventFixture({
  timestamp,
  data,
}: {
  timestamp: Date;
  data: incrementalSnapshotEvent['data'];
}): IncrementalSnapshotEvent {
  return {
    type: EventType.IncrementalSnapshot,
    timestamp: timestamp.getTime(),
    data,
  }
}

export function RRWebDOMFrameFixture({
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

export function RRWebHelloWorldFrameFixture() {
  return RRWebDOMFrameFixture({
    tagName: 'div',
    childNodes: [
      RRWebDOMFrameFixture({
        tagName: 'h1',
        attributes: {style: 'text-align: center;'},
        childNodes: [
          RRWebDOMFrameFixture({
            textContent: 'Hello World',
          }),
        ],
      }),
    ],
  });
}
