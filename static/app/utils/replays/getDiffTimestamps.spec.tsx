import invariant from 'invariant';
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
import ReplayReader from 'sentry/utils/replays/replayReader';
import {
  IncrementalSource,
  isHydrationErrorFrame,
  type RawBreadcrumbFrame,
} from 'sentry/utils/replays/types';
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

function getMockReplay(rrwebEvents: any[], errors: ReplayError[]) {
  const attachments = [...rrwebEvents];
  const replay = ReplayReader.factory({
    replayRecord,
    errors,
    fetching: false,
    attachments,
  });

  return {replay};
}

function getMockReplayWithCrumbFrame(
  rrwebEvents: any[],
  crumbFrame: RawBreadcrumbFrame,
  errors: ReplayError[]
) {
  const attachments = [...rrwebEvents];

  attachments.push(
    ReplayBreadcrumbFrameEventFixture({
      timestamp: new Date(crumbFrame.timestamp),
      data: {
        payload: crumbFrame,
      },
    })
  );

  const [hydrationErrorFrame] = hydrateBreadcrumbs(
    replayRecord,
    crumbFrame ? [crumbFrame] : []
  );

  const replay = ReplayReader.factory({
    replayRecord,
    errors,
    fetching: false,
    attachments,
  });

  invariant(isHydrationErrorFrame(hydrationErrorFrame!), '');
  return {hydrationErrorFrame, replay};
}

describe('getReplayDiffOffsetsFromFrame', () => {
  it('should return the offset of the requested frame, and the next frame', () => {
    const rawHydrationCrumbFrame = ReplayHydrationErrorFrameFixture({
      timestamp: CRUMB_1_DATE,
    });
    const {replay, hydrationErrorFrame} = getMockReplayWithCrumbFrame(
      RRWEB_EVENTS,
      rawHydrationCrumbFrame,
      []
    );

    const [hydratedHydrationCrumbFrame] = hydrateBreadcrumbs(replayRecord, [
      rawHydrationCrumbFrame,
    ]);
    expect(getReplayDiffOffsetsFromFrame(replay, hydrationErrorFrame)).toEqual({
      frameOrEvent: hydratedHydrationCrumbFrame,
      leftOffsetMs: 200, // offset of FULL_DATE
      rightOffsetMs: 5_000, // offset of the INCR_DATE
    });
  });

  it('should return the offset of the requested frame, and 1 if there is no next frame', () => {
    const rawHydrationCrumbFrame = ReplayHydrationErrorFrameFixture({
      timestamp: CRUMB_2_DATE,
    });
    const {replay, hydrationErrorFrame} = getMockReplayWithCrumbFrame(
      RRWEB_EVENTS,
      rawHydrationCrumbFrame,
      []
    );

    const [hydratedHydrationCrumbFrame] = hydrateBreadcrumbs(replayRecord, [
      rawHydrationCrumbFrame,
    ]);
    expect(getReplayDiffOffsetsFromFrame(replay, hydrationErrorFrame)).toEqual({
      frameOrEvent: hydratedHydrationCrumbFrame,
      leftOffsetMs: 5_000, // offset of INCR_DATE
      rightOffsetMs: 1, // no next mutation date, so offset is 1
    });
  });
});

describe('getReplayDiffOffsetsFromEvent', () => {
  it('should get offsets based on a hydration breadcrumb that occurs within the same second of the error', () => {
    const rawHydrationCrumbFrame = ReplayHydrationErrorFrameFixture({
      timestamp: CRUMB_1_DATE,
    });
    const errorEvent = EventFixture({dateCreated: ERROR_DATE.toISOString()});
    const {replay} = getMockReplayWithCrumbFrame(RRWEB_EVENTS, rawHydrationCrumbFrame, [
      errorEvent as any as ReplayError,
    ]);

    const [hydratedHydrationCrumbFrame] = hydrateBreadcrumbs(replayRecord, [
      rawHydrationCrumbFrame,
    ]);
    expect(getReplayDiffOffsetsFromEvent(replay!, errorEvent)).toEqual({
      frameOrEvent: hydratedHydrationCrumbFrame,
      leftOffsetMs: 200, // offset of FULL_DATE
      rightOffsetMs: 5_000, // offset of the INCR_DATE
    });
  });

  it('should get offsets when no hydration breadcrumb exists', () => {
    const errorEvent = EventFixture({dateCreated: ERROR_DATE.toISOString()});
    const {replay} = getMockReplay(RRWEB_EVENTS, [errorEvent as any as ReplayError]);

    expect(getReplayDiffOffsetsFromEvent(replay!, errorEvent)).toEqual({
      frameOrEvent: errorEvent,
      leftOffsetMs: 1_000, // offset of ERROR_DATE
      rightOffsetMs: 5_000, // offset of the INCR_DATE
    });
  });
});
