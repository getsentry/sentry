import {EventFixture} from 'sentry-fixture/event';
import {ReplayHydrationErrorFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayBreadcrumbFrameEventFixture} from 'sentry-fixture/replay/replayFrameEvents';
import {
  RRWebDOMFrameFixture,
  RRWebFullSnapshotFrameEventFixture,
  RRWebIncrementalSnapshotFrameEventFixture,
  RRWebInitFrameEventsFixture,
} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {
  getReplayDiffOffsetsFromEvent,
  getReplayDiffOffsetsFromFrame,
} from 'sentry/utils/replays/getDiffTimestamps';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
import hydrateFrames from 'sentry/utils/replays/hydrateFrames';
import ReplayReader from 'sentry/utils/replays/replayReader';
import {IncrementalSource, type RawBreadcrumbFrame} from 'sentry/utils/replays/types';
import type {ReplayError} from 'sentry/views/replays/types';

const START_DATE = new Date('2022-06-15T00:40:00.000Z');
const INIT_DATE = new Date('2022-06-15T00:40:00.100Z');
const FULL_DATE = new Date('2022-06-15T00:40:00.200Z');
const ERROR_DATE = new Date('2022-06-15T00:40:01.000Z'); // errors do not have ms precision
const CRUMB_1_DATE = new Date('2022-06-15T00:40:01.350Z');
const INCR_DATE = new Date('2022-06-15T00:40:05.000Z');
const CRUMB_2_DATE = new Date('2022-06-15T00:40:05.350Z');
const END_DATE = new Date('2022-06-15T00:50:00.555Z');

const replayRecord = ReplayRecordFixture({
  started_at: START_DATE,
  finished_at: END_DATE,
});

const RRWEB_EVENTS = [
  ...RRWebInitFrameEventsFixture({
    timestamp: INIT_DATE,
  }),
  RRWebFullSnapshotFrameEventFixture({timestamp: FULL_DATE}),
  RRWebIncrementalSnapshotFrameEventFixture({
    timestamp: INCR_DATE,
    data: {
      source: IncrementalSource.Mutation,
      adds: [
        {
          node: RRWebDOMFrameFixture({
            tagName: 'canvas',
          }),
          parentId: 0,
          nextId: null,
        },
      ],
      removes: [],
      texts: [],
      attributes: [],
    },
  }),
];

function getMockReplay(
  rrwebEvents: any[],
  crumbFrame: undefined | RawBreadcrumbFrame,
  errors: ReplayError[]
) {
  const attachments = [...rrwebEvents];

  if (crumbFrame) {
    attachments.push(
      ReplayBreadcrumbFrameEventFixture({
        timestamp: new Date(crumbFrame.timestamp),
        data: {
          payload: crumbFrame,
        },
      })
    );
  }

  const {rrwebFrames} = hydrateFrames(attachments);
  const [hydrationCrumb] = hydrateBreadcrumbs(
    replayRecord,
    crumbFrame ? [crumbFrame] : [],
    rrwebFrames
  );

  const replay = ReplayReader.factory({
    replayRecord,
    errors,
    attachments,
  });

  return {replay, hydrationCrumb};
}

describe('getReplayDiffOffsetsFromFrame', () => {
  it('should return the offset of the requested frame, and the next frame', () => {
    const hydrationCrumbFrame = ReplayHydrationErrorFrameFixture({
      timestamp: CRUMB_1_DATE,
    });
    const {replay, hydrationCrumb} = getMockReplay(RRWEB_EVENTS, hydrationCrumbFrame, []);

    expect(getReplayDiffOffsetsFromFrame(replay, hydrationCrumb)).toEqual({
      leftOffsetMs: 1_350, // offset of CRUMB_1_DATE
      rightOffsetMs: 5_000, // offset of the INCR_DATE
    });
  });

  it('should return the offset of the requested frame, and 0 if there is no next frame', () => {
    const hydrationCrumbFrame = ReplayHydrationErrorFrameFixture({
      timestamp: CRUMB_2_DATE,
    });
    const {replay, hydrationCrumb} = getMockReplay(RRWEB_EVENTS, hydrationCrumbFrame, []);

    expect(getReplayDiffOffsetsFromFrame(replay, hydrationCrumb)).toEqual({
      leftOffsetMs: 5_350, // offset of CRUMB_2_DATE
      rightOffsetMs: 0, // no next mutation date, so offset is 0
    });
  });
});

describe('getReplayDiffOffsetsFromEvent', () => {
  it('should get offsets based on a hydration breadcrumb that occurs within the same second of the error', () => {
    const hydrationCrumbFrame = ReplayHydrationErrorFrameFixture({
      timestamp: CRUMB_1_DATE,
    });
    const errorEvent = EventFixture({dateCreated: ERROR_DATE.toISOString()});
    const {replay} = getMockReplay(RRWEB_EVENTS, hydrationCrumbFrame, [
      errorEvent as any as ReplayError,
    ]);

    expect(getReplayDiffOffsetsFromEvent(replay!, errorEvent)).toEqual({
      leftOffsetMs: 1_350, // offset of CRUMB_1_DATE
      rightOffsetMs: 5_000, // offset of the INCR_DATE
    });
  });

  it('should get offsets when no hydration breadcrumb exists', () => {
    const errorEvent = EventFixture({dateCreated: ERROR_DATE.toISOString()});
    const {replay} = getMockReplay(RRWEB_EVENTS, undefined, [
      errorEvent as any as ReplayError,
    ]);

    expect(getReplayDiffOffsetsFromEvent(replay!, errorEvent)).toEqual({
      leftOffsetMs: 1_000, // offset of ERROR_DATE
      rightOffsetMs: 5_000, // offset of the INCR_DATE
    });
  });
});
