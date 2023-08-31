/**
 * @jest-environment jsdom
 */

import * as rrdom from 'rrdom';

import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import extractDomNodes from 'sentry/utils/replays/extractDomNodes';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
import {RecordingFrame} from 'sentry/utils/replays/types';

// @ts-expect-error
global.document = new rrdom.RRDocument();
// @ts-expect-error
global.window = new rrdom.RRWindow();

const clickTimestamps = [1663691570812, 1663691581324, 1663691586599, 1663691599600];

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
        parentId: 0,
        previousId: null,
        nextId: null,
        node: TestStubs.Replay.RRWebDOMFrame({
          tagName: 'button',
          attributes: {class: 'css-507rzt e1lk5gpt0'},
          textContent: 'This is a button',
          id: 424,
        }),
      },
      {
        parentId: 0,
        previousId: null,
        nextId: null,
        node: TestStubs.Replay.RRWebDOMFrame({
          tagName: 'div',
          attributes: {class: 'loadmore', style: 'display: block;'},
          textContent: 'Load more...',
          id: 9304,
        }),
      },
    ],
  }),
  TestStubs.Replay.RRWebIncrementalSnapshotEvent({
    timestamp: new Date(clickTimestamps[1] + 500), // in between 2nd and 3rd click timestamps
    attributes: [
      {
        id: 424,
        attributes: {class: 'loadmore', style: 'display: grid;'},
      },
    ],
  }),
  TestStubs.Replay.RRWebIncrementalSnapshotEvent({
    timestamp: new Date(clickTimestamps[3] - 500), // right before last click
    attributes: [
      {
        id: 9304,
        attributes: {class: 'css-507rzt abcdefg'},
      },
    ],
  }),
];

const frames = hydrateBreadcrumbs(TestStubs.ReplayRecord(), [
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

const EXTRACTION_1 = {
  frame: frames[0],
  html: '<button class="css-507rzt e1lk5gpt0">This is a button</button>',
  timestamp: clickTimestamps[0],
};

const EXTRACTION_2 = {
  frame: frames[1],
  html: '<div class="loadmore" style="display: block;">Load more...</div>',
  timestamp: clickTimestamps[1],
};

const EXTRACTION_3 = {
  frame: frames[2],
  html: '<div class="loadmore" style="display: grid;">Load more...</div>',
  timestamp: clickTimestamps[2],
};

const EXTRACTION_4 = {
  frame: frames[3],
  html: '<button class="css-507rzt abcdefg">This is a button</button>',
  timestamp: clickTimestamps[3],
};

const extractions: Extraction[] = [
  EXTRACTION_1,
  EXTRACTION_2,
  EXTRACTION_3,
  EXTRACTION_4,
];

describe('extractDomNodes', () => {
  it('should return the correct DOM events extractions', async () => {
    const result = await extractDomNodes({frames, rrwebEvents});
    expect(result).toStrictEqual(extractions);
  });
});
