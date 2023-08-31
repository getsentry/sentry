import * as rrdom from 'rrdom';

import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import extractDomNodes from 'sentry/utils/replays/extractDomNodes';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
import {RecordingFrame} from 'sentry/utils/replays/types';

// @ts-expect-error
global.document = new rrdom.RRDocument();
// @ts-expect-error
global.window = new rrdom.RRWindow();

const BASE_TIME = 1663691500000;
const clickTimestamps = [BASE_TIME, BASE_TIME + 1000, BASE_TIME + 2000, BASE_TIME + 3000];

const replayRecord = TestStubs.ReplayRecord({
  started_at: new Date(BASE_TIME - 1000),
});

const rrwebEvents: RecordingFrame[] = [
  ...(TestStubs.Replay.RRWebInitFrameEvents({
    timestamp: new Date(clickTimestamps[0] - 500),
  }) as RecordingFrame[]),
  TestStubs.Replay.RRWebFullSnapshotFrameEvent({
    timestamp: new Date(clickTimestamps[0] - 500),
  }),
  TestStubs.Replay.RRWebIncrementalSnapshotEvent({
    timestamp: new Date(clickTimestamps[0] - 500),
    adds: [
      {
        parentId: 1,
        nextId: null,
        node: TestStubs.Replay.RRWebDOMFrame({
          id: 424,
          tagName: 'button',
          attributes: {class: 'original-class'},
          childNodes: [
            TestStubs.Replay.RRWebDOMFrame({
              id: 425,
              textContent: 'This is a button',
            }),
          ],
        }),
      },
      {
        parentId: 1,
        nextId: null,
        node: TestStubs.Replay.RRWebDOMFrame({
          id: 9304,
          tagName: 'div',
          attributes: {class: 'loadmore', style: 'display: block;'},
          childNodes: [
            TestStubs.Replay.RRWebDOMFrame({
              id: 9305,
              textContent: 'Load more...',
            }),
          ],
        }),
      },
    ],
  }),
  TestStubs.Replay.RRWebIncrementalSnapshotEvent({
    timestamp: new Date(clickTimestamps[2] - 500), // in between 2nd and 3rd click timestamps
    attributes: [
      {
        id: 9304,
        attributes: {style: 'display: grid;'},
      },
    ],
  }),
  TestStubs.Replay.RRWebIncrementalSnapshotEvent({
    timestamp: new Date(clickTimestamps[3] - 500), // right before last click
    attributes: [
      {
        id: 424,
        attributes: {class: 'new-class'},
      },
    ],
  }),
];

const frames = hydrateBreadcrumbs(replayRecord, [
  TestStubs.Replay.ClickFrame({
    timestamp: new Date(clickTimestamps[0]),
    data: {
      nodeId: 424,
    },
  }),
  TestStubs.Replay.ClickFrame({
    timestamp: new Date(clickTimestamps[1]),
    data: {
      nodeId: 9304,
    },
  }),
  TestStubs.Replay.ClickFrame({
    timestamp: new Date(clickTimestamps[2]),
    data: {
      nodeId: 9304,
    },
  }),
  TestStubs.Replay.ClickFrame({
    timestamp: new Date(clickTimestamps[3]),
    data: {
      nodeId: 424,
    },
  }),
]);

const extractions: Extraction[] = [
  {
    frame: frames[0],
    html: '<button class="original-class">This is a button</button>',
    timestamp: frames[0].timestampMs,
  },

  {
    frame: frames[1],
    html: '<div class="loadmore" style="display: block;">Load more...</div>',
    timestamp: frames[1].timestampMs,
  },

  {
    frame: frames[2],
    html: '<div class="loadmore" style="display: grid;">Load more...</div>',
    timestamp: frames[2].timestampMs,
  },

  {
    frame: frames[3],
    html: '<button class="new-class">This is a button</button>',
    timestamp: frames[3].timestampMs,
  },
];

describe('extractDomNodes', () => {
  it('should return the correct DOM events extractions', async () => {
    const result = await extractDomNodes({frames, rrwebEvents});
    expect(result).toStrictEqual(extractions);
  }, 10000);
});
