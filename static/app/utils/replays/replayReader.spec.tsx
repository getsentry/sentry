import {
  ReplayClickEventFixture,
  ReplayConsoleEventFixture,
  ReplayDeadClickEventFixture,
  ReplayMemoryEventFixture,
  ReplayNavigateEventFixture,
} from 'sentry-fixture/replay/helpers';
import {ReplayNavFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {
  ReplayBreadcrumbFrameEventFixture,
  ReplayOptionFrameEventFixture,
  ReplayOptionFrameFixture,
  ReplaySpanFrameEventFixture,
} from 'sentry-fixture/replay/replayFrameEvents';
import {ReplayRequestFrameFixture} from 'sentry-fixture/replay/replaySpanFrameData';
import {
  RRWebDOMFrameFixture,
  RRWebFullSnapshotFrameEventFixture,
  RRWebIncrementalSnapshotFrameEventFixture,
} from 'sentry-fixture/replay/rrweb';
import {ReplayErrorFixture} from 'sentry-fixture/replayError';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import ReplayReader from 'sentry/utils/replays/replayReader';
import {EventType, IncrementalSource} from 'sentry/utils/replays/types';

describe('ReplayReader', () => {
  const replayRecord = ReplayRecordFixture();

  it('Should return null if there are missing arguments', () => {
    const missingAttachments = ReplayReader.factory({
      attachments: undefined,
      errors: [],
      fetching: false,
      replayRecord,
    });
    expect(missingAttachments).toBeNull();

    const missingErrors = ReplayReader.factory({
      attachments: [],
      errors: undefined,
      fetching: false,
      replayRecord,
    });
    expect(missingErrors).toBeNull();

    const missingRecord = ReplayReader.factory({
      attachments: [],
      errors: [],
      fetching: false,
      replayRecord: undefined,
    });
    expect(missingRecord).toBeNull();
  });

  it('should calculate started_at/finished_at/duration based on first/last events', () => {
    const minuteZero = new Date('2023-12-25T00:00:00');
    const minuteTen = new Date('2023-12-25T00:10:00');

    const replay = ReplayReader.factory({
      attachments: [
        ReplayConsoleEventFixture({timestamp: minuteZero}),
        ReplayConsoleEventFixture({timestamp: minuteTen}),
      ],
      errors: [],
      fetching: false,
      replayRecord: ReplayRecordFixture({
        started_at: new Date('2023-12-25T00:01:00'),
        finished_at: new Date('2023-12-25T00:09:00'),
        duration: undefined, // will be calculated
      }),
    });

    const expectedDuration = 10 * 60 * 1000; // 10 minutes, in ms
    expect(replay?.getReplay().started_at).toEqual(minuteZero);
    expect(replay?.getReplay().finished_at).toEqual(minuteTen);
    expect(replay?.getReplay().duration.asMilliseconds()).toEqual(expectedDuration);
    expect(replay?.getDurationMs()).toEqual(expectedDuration);
  });

  it('should make the replayRecord available through a getter method', () => {
    const replay = ReplayReader.factory({
      attachments: [],
      errors: [],
      fetching: false,
      replayRecord,
    });

    expect(replay?.getReplay()).toEqual(replayRecord);
  });

  describe('attachment splitting', () => {
    const timestamp = new Date('2023-12-25T00:02:00');
    const secondTimestamp = new Date('2023-12-25T00:04:00');
    const thirdTimestamp = new Date('2023-12-25T00:05:00');

    const optionsFrame = ReplayOptionFrameFixture();
    const optionsEvent = ReplayOptionFrameEventFixture({
      timestamp,
      data: {payload: optionsFrame},
    });
    const firstDiv = RRWebFullSnapshotFrameEventFixture({timestamp});
    const secondDiv = RRWebFullSnapshotFrameEventFixture({timestamp});
    const clickEvent = ReplayClickEventFixture({timestamp});
    const secondClickEvent = ReplayClickEventFixture({timestamp: secondTimestamp});
    const thirdClickEvent = ReplayClickEventFixture({timestamp: thirdTimestamp});
    const deadClickEvent = ReplayDeadClickEventFixture({timestamp});
    const firstMemory = ReplayMemoryEventFixture({
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
    const secondMemory = ReplayMemoryEventFixture({
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
    const navigationEvent = ReplayNavigateEventFixture({
      startTimestamp: new Date('2023-12-25T00:03:00'),
      endTimestamp: new Date('2023-12-25T00:03:30'),
    });
    const navCrumb = ReplayBreadcrumbFrameEventFixture({
      timestamp: new Date('2023-12-25T00:03:00'),
      data: {
        payload: ReplayNavFrameFixture({
          timestamp: new Date('2023-12-25T00:03:00'),
        }),
      },
    });
    const consoleEvent = ReplayConsoleEventFixture({timestamp});
    const customEvent = ReplayBreadcrumbFrameEventFixture({
      timestamp: new Date('2023-12-25T00:02:30'),
      data: {
        payload: {
          category: 'redux.action',
          data: {
            action: 'save.click',
          },
          message: '',
          timestamp: new Date('2023-12-25T00:02:30').getTime() / 1000,
          type: BreadcrumbType.DEFAULT,
        },
      },
    });
    const attachments = [
      clickEvent,
      secondClickEvent,
      thirdClickEvent,
      consoleEvent,
      firstDiv,
      firstMemory,
      navigationEvent,
      navCrumb,
      optionsEvent,
      secondDiv,
      secondMemory,
      customEvent,
      deadClickEvent,
    ];

    it.each([
      {
        method: 'getRRWebFrames',
        expected: [
          firstDiv,
          secondDiv,
          {
            type: EventType.Custom,
            timestamp: expect.any(Number),
            data: {tag: 'replay.end', payload: {}},
          },
        ],
      },
      {
        method: 'getConsoleFrames',
        expected: [expect.objectContaining({category: 'console'})],
      },
      {
        method: 'getCustomFrames',
        expected: [expect.objectContaining({category: 'redux.action'})],
      },
      {
        method: 'getNetworkFrames',
        expected: [expect.objectContaining({op: 'navigation.navigate'})],
      },
      {
        method: 'getDOMFrames',
        expected: [
          expect.objectContaining({category: 'ui.slowClickDetected'}),
          expect.objectContaining({category: 'ui.click'}),
          expect.objectContaining({category: 'ui.click'}),
        ],
      },
      {
        method: 'getMemoryFrames',
        expected: [
          expect.objectContaining({op: 'memory'}),
          expect.objectContaining({op: 'memory'}),
        ],
      },
      {
        method: 'getChapterFrames',
        expected: [
          expect.objectContaining({category: 'replay.init'}),
          expect.objectContaining({category: 'ui.slowClickDetected'}),
          expect.objectContaining({category: 'redux.action'}),
          expect.objectContaining({op: 'navigation.navigate'}), // prefer the nav span over the breadcrumb
          expect.objectContaining({category: 'ui.click'}),
          expect.objectContaining({category: 'ui.click'}),
        ],
      },
      {
        method: 'getSDKOptions',
        expected: optionsFrame,
      },
    ] as const)('Calling $method will filter frames', ({method, expected}) => {
      const replay = ReplayReader.factory({
        attachments,
        errors: [],
        fetching: false,
        replayRecord,
      });

      const exec = replay?.[method];
      expect(exec?.()).toStrictEqual(expected);
    });
  });

  it('shoud return the SDK config if there is a RecordingOptions event found', () => {
    const timestamp = new Date();
    const optionsFrame = ReplayOptionFrameFixture();

    const replay = ReplayReader.factory({
      attachments: [
        ReplayOptionFrameEventFixture({
          timestamp,
          data: {payload: optionsFrame},
        }),
      ],
      errors: [],
      fetching: false,
      replayRecord,
    });

    expect(replay?.getSDKOptions()).toBe(optionsFrame);
  });

  describe('isNetworkDetailsSetup', () => {
    it('should have isNetworkDetailsSetup=true if sdkConfig says so', () => {
      const timestamp = new Date();

      const replay = ReplayReader.factory({
        attachments: [
          ReplayOptionFrameEventFixture({
            timestamp,
            data: {
              payload: ReplayOptionFrameFixture({
                networkDetailHasUrls: true,
              }),
            },
          }),
        ],
        errors: [],
        fetching: false,
        replayRecord,
      });

      expect(replay?.isNetworkDetailsSetup()).toBeTruthy();
    });

    it.each([
      {
        data: {
          method: 'GET',
          request: {headers: {accept: 'application/json'}},
        },
        expected: true,
      },
      {
        data: {
          method: 'GET',
        },
        expected: false,
      },
    ])('should have isNetworkDetailsSetup=$expected', ({data, expected}) => {
      const startTimestamp = new Date();
      const endTimestamp = new Date();
      const replay = ReplayReader.factory({
        attachments: [
          ReplaySpanFrameEventFixture({
            timestamp: startTimestamp,
            data: {
              payload: ReplayRequestFrameFixture({
                op: 'resource.fetch',
                startTimestamp,
                endTimestamp,
                description: '/api/0/issues/',
                data,
              }),
            },
          }),
        ],
        errors: [],
        fetching: false,
        replayRecord,
      });

      expect(replay?.isNetworkDetailsSetup()).toBe(expected);
    });
  });

  it('detects canvas element from full snapshot', () => {
    const timestamp = new Date('2023-12-25T00:02:00');

    const firstDiv = RRWebFullSnapshotFrameEventFixture({
      timestamp,
      childNodes: [
        RRWebDOMFrameFixture({
          tagName: 'div',
          childNodes: [
            RRWebDOMFrameFixture({
              tagName: 'canvas',
            }),
          ],
        }),
      ],
    });
    const attachments = [firstDiv];

    const replay = ReplayReader.factory({
      attachments,
      errors: [],
      fetching: false,
      replayRecord,
    });

    expect(replay?.hasCanvasElementInReplay()).toBe(true);
  });

  it('detects canvas element from dom mutations', () => {
    const timestamp = new Date('2023-12-25T00:02:00');

    const snapshot = RRWebFullSnapshotFrameEventFixture({timestamp});
    const increment = RRWebIncrementalSnapshotFrameEventFixture({
      timestamp,
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
    });

    const replay = ReplayReader.factory({
      attachments: [snapshot, increment],
      errors: [],
      fetching: false,
      replayRecord,
    });

    expect(replay?.hasCanvasElementInReplay()).toBe(true);
  });

  describe('clip window', () => {
    const replayStartedAt = new Date('2024-01-01T00:02:00');
    const replayFinishedAt = new Date('2024-01-01T00:04:00');

    const clipStartTimestamp = new Date('2024-01-01T00:03:00');
    const clipEndTimestamp = new Date('2024-01-01T00:03:10');

    const rrwebFrame1 = RRWebFullSnapshotFrameEventFixture({
      timestamp: new Date('2024-01-01T00:02:30'),
    });
    const rrwebFrame2 = RRWebFullSnapshotFrameEventFixture({
      timestamp: new Date('2024-01-01T00:03:09'),
    });
    const rrwebFrame3 = RRWebFullSnapshotFrameEventFixture({
      timestamp: new Date('2024-01-01T00:03:30'),
    });

    const breadcrumbAttachment1 = ReplayBreadcrumbFrameEventFixture({
      timestamp: new Date('2024-01-01T00:02:30'),
      data: {
        payload: ReplayNavFrameFixture({
          timestamp: new Date('2024-01-01T00:02:30'),
        }),
      },
    });
    const breadcrumbAttachment2 = ReplayBreadcrumbFrameEventFixture({
      timestamp: new Date('2024-01-01T00:03:05'),
      data: {
        payload: ReplayNavFrameFixture({
          timestamp: new Date('2024-01-01T00:03:05'),
        }),
      },
    });
    const breadcrumbAttachment3 = ReplayBreadcrumbFrameEventFixture({
      timestamp: new Date('2024-01-01T00:03:30'),
      data: {
        payload: ReplayNavFrameFixture({
          timestamp: new Date('2024-01-01T00:03:30'),
        }),
      },
    });

    const error1 = ReplayErrorFixture({
      id: '1',
      issue: '100',
      timestamp: '2024-01-01T00:02:30',
    });
    const error2 = ReplayErrorFixture({
      id: '2',
      issue: '200',
      timestamp: '2024-01-01T00:03:06',
    });
    const error3 = ReplayErrorFixture({
      id: '1',
      issue: '100',
      timestamp: '2024-01-01T00:03:30',
    });

    const replay = ReplayReader.factory({
      attachments: [
        rrwebFrame1,
        rrwebFrame2,
        rrwebFrame3,
        breadcrumbAttachment1,
        breadcrumbAttachment2,
        breadcrumbAttachment3,
      ],
      errors: [error1, error2, error3],
      fetching: false,
      replayRecord: ReplayRecordFixture({
        started_at: replayStartedAt,
        finished_at: replayFinishedAt,
      }),
      clipWindow: {
        startTimestampMs: clipStartTimestamp.getTime(),
        endTimestampMs: clipEndTimestamp.getTime(),
      },
    });

    it('should adjust the end time and duration for the clip window', () => {
      // Duration should be between the clip start time and end time
      expect(replay?.getDurationMs()).toBe(10_000);
      // Start offset should be set
      expect(replay?.getStartOffsetMs()).toEqual(
        clipStartTimestamp.getTime() - replayStartedAt.getTime()
      );
      expect(replay?.getStartTimestampMs()).toEqual(clipStartTimestamp.getTime());
    });

    it('should trim rrweb frames from the end but not the beginning', () => {
      expect(replay?.getRRWebFrames()).toEqual([
        expect.objectContaining({
          type: EventType.FullSnapshot,
          timestamp: rrwebFrame1.timestamp,
        }),
        expect.objectContaining({
          type: EventType.FullSnapshot,
          timestamp: rrwebFrame2.timestamp,
        }),
        expect.objectContaining({
          type: EventType.Custom,
          data: {tag: 'replay.clip_end', payload: {}},
          timestamp: clipEndTimestamp.getTime(),
        }),
        // rrwebFrame3 should not be returned
      ]);
    });

    it('should only return chapter frames within window and shift their clipOffsets', () => {
      expect(replay?.getChapterFrames()).toEqual([
        // Only breadcrumb2 and error2 should be included
        expect.objectContaining({
          category: 'navigation',
          timestampMs: breadcrumbAttachment2.timestamp,
          // offset is relative to the start of the clip window
          offsetMs: 5_000,
        }),
        expect.objectContaining({
          category: 'issue',
          timestampMs: new Date(error2.timestamp).getTime(),
          offsetMs: 6_000,
        }),
      ]);
    });
  });
});
