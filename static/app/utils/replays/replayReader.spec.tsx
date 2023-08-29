import {EventType} from '@sentry-internal/rrweb';

import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import ReplayReader from 'sentry/utils/replays/replayReader';

describe('ReplayReader', () => {
  const replayRecord = TestStubs.ReplayRecord({});

  it('Should return null if there are missing arguments', () => {
    const missingAttachments = ReplayReader.factory({
      attachments: undefined,
      errors: [],
      replayRecord,
    });
    expect(missingAttachments).toBeNull();

    const missingErrors = ReplayReader.factory({
      attachments: [],
      errors: undefined,
      replayRecord,
    });
    expect(missingErrors).toBeNull();

    const missingRecord = ReplayReader.factory({
      attachments: [],
      errors: [],
      replayRecord: undefined,
    });
    expect(missingRecord).toBeNull();
  });

  it('should calculate started_at/finished_at/duration based on first/last events', () => {
    const minuteZero = new Date('2023-12-25T00:00:00');
    const minuteTen = new Date('2023-12-25T00:10:00');

    const replay = ReplayReader.factory({
      attachments: [
        TestStubs.Replay.ConsoleEvent({timestamp: minuteZero}),
        TestStubs.Replay.ConsoleEvent({timestamp: minuteTen}),
      ],
      errors: [],
      replayRecord: TestStubs.ReplayRecord({
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
      replayRecord,
    });

    expect(replay?.getReplay()).toEqual(replayRecord);
  });

  describe('attachment splitting', () => {
    const timestamp = new Date('2023-12-25T00:02:00');
    const secondTimestamp = new Date('2023-12-25T00:04:00');
    const thirdTimestamp = new Date('2023-12-25T00:05:00');

    const optionsFrame = TestStubs.Replay.OptionFrame({});
    const optionsEvent = TestStubs.Replay.OptionFrameEvent({
      timestamp,
      data: {payload: optionsFrame},
    });
    const firstDiv = TestStubs.Replay.RRWebFullSnapshotFrameEvent({timestamp});
    const secondDiv = TestStubs.Replay.RRWebFullSnapshotFrameEvent({timestamp});
    const clickEvent = TestStubs.Replay.ClickEvent({timestamp});
    const secondClickEvent = TestStubs.Replay.ClickEvent({timestamp: secondTimestamp});
    const thirdClickEvent = TestStubs.Replay.ClickEvent({timestamp: thirdTimestamp});
    const deadClickEvent = TestStubs.Replay.DeadClickEvent({timestamp});
    const firstMemory = TestStubs.Replay.MemoryEvent({
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
    const secondMemory = TestStubs.Replay.MemoryEvent({
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
    const navigationEvent = TestStubs.Replay.NavigateEvent({
      startTimestamp: new Date('2023-12-25T00:03:00'),
      endTimestamp: new Date('2023-12-25T00:03:30'),
    });
    const navCrumb = TestStubs.Replay.BreadcrumbFrameEvent({
      timestamp: new Date('2023-12-25T00:03:00'),
      data: {
        payload: TestStubs.Replay.NavFrame({
          timestamp: new Date('2023-12-25T00:03:00'),
        }),
      },
    });
    const consoleEvent = TestStubs.Replay.ConsoleEvent({timestamp});
    const customEvent = TestStubs.Replay.BreadcrumbFrameEvent({
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
          {
            type: EventType.Custom,
            timestamp: expect.any(Number),
            data: {tag: 'replay.start', payload: {}},
          },
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
        expected: [
          expect.objectContaining({category: 'console'}),
          expect.objectContaining({category: 'redux.action'}),
        ],
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
          expect.objectContaining({category: 'navigation'}),
          expect.objectContaining({category: 'ui.click'}),
          expect.objectContaining({category: 'ui.click'}),
        ],
      },
      {
        method: 'getSDKOptions',
        expected: optionsFrame,
      },
    ])('Calling $method will filter frames', ({method, expected}) => {
      const replay = ReplayReader.factory({
        attachments,
        errors: [],
        replayRecord,
      });

      const exec = replay?.[method];
      expect(exec()).toStrictEqual(expected);
    });
  });

  it('shoud return the SDK config if there is a RecordingOptions event found', () => {
    const timestamp = new Date();
    const optionsFrame = TestStubs.Replay.OptionFrame({});

    const replay = ReplayReader.factory({
      attachments: [
        TestStubs.Replay.OptionFrameEvent({
          timestamp,
          data: {payload: optionsFrame},
        }),
      ],
      errors: [],
      replayRecord,
    });

    expect(replay?.getSDKOptions()).toBe(optionsFrame);
  });

  describe('isNetworkDetailsSetup', () => {
    it('should have isNetworkDetailsSetup=true if sdkConfig says so', () => {
      const timestamp = new Date();

      const replay = ReplayReader.factory({
        attachments: [
          TestStubs.Replay.OptionFrameEvent({
            timestamp,
            data: {
              payload: TestStubs.Replay.OptionFrame({
                networkDetailHasUrls: true,
              }),
            },
          }),
        ],
        errors: [],
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
          TestStubs.Replay.SpanFrameEvent({
            timestamp: startTimestamp,
            data: {
              payload: TestStubs.Replay.RequestFrame({
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
        replayRecord,
      });

      expect(replay?.isNetworkDetailsSetup()).toBe(expected);
    });
  });
});
