import {EventType} from '@sentry-internal/rrweb';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {spansFactory} from 'sentry/utils/replays/replayDataUtils';
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
    const timestamp = new Date();
    const firstDiv = TestStubs.Replay.RRWebFullSnapshotFrameEvent({timestamp});
    const secondDiv = TestStubs.Replay.RRWebFullSnapshotFrameEvent({timestamp});
    const clickEvent = TestStubs.Replay.ClickEvent({timestamp});
    const firstMemory = TestStubs.Replay.MemoryEvent({
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
    const secondMemory = TestStubs.Replay.MemoryEvent({
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
    const navigationEvent = TestStubs.Replay.NavigateEvent({
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
    const consoleEvent = TestStubs.Replay.ConsoleEvent({timestamp});
    const replayEnd = {
      type: EventType.Custom,
      timestamp: replayRecord.finished_at.getTime(),
      data: {
        tag: 'replay-end',
      },
    };
    const attachments = [
      clickEvent,
      consoleEvent,
      firstDiv,
      firstMemory,
      navigationEvent,
      secondDiv,
      secondMemory,
    ];

    const {
      startTimestamp,
      endTimestamp: _2,
      op: _1,
      ...payload
    } = navigationEvent.data.payload;
    const expectedNav = {
      ...payload,
      action: 'navigate',
      category: 'default',
      color: 'green300',
      description: 'Navigation',
      id: 2,
      level: 'info',
      message: '',
      type: 'navigation',
      data: {
        ...payload.data,
        label: 'Page load',
        to: '',
      },
      timestamp: new Date(startTimestamp * 1000).toISOString(),
    };

    function patchEvents(events) {
      return transformCrumbs(
        events.map(event => ({
          ...event.data.payload,
          id: expect.any(Number),
          timestamp: new Date(event.data.payload.timestamp * 1000).toISOString(),
        }))
      );
    }
    function patchSpanEvents(events) {
      return spansFactory(
        events.map(event => ({
          ...event.data.payload,
          id: expect.any(String),
          endTimestamp: event.data.payload.endTimestamp,
          startTimestamp: event.data.payload.startTimestamp,
        }))
      );
    }

    it.each([
      {
        method: 'getRRWebEvents',
        expected: [firstDiv, secondDiv, replayEnd],
      },
      {
        method: 'getCrumbsWithRRWebNodes',
        expected: patchEvents([clickEvent]),
      },
      {
        method: 'getUserActionCrumbs',
        expected: [...patchEvents([clickEvent]), expectedNav],
      },
      {
        method: 'getConsoleCrumbs',
        // Need a non-console event in here so the `id` ends up correct,
        // slice() removes the extra item later
        expected: patchEvents([clickEvent, consoleEvent]).slice(1),
      },
      {
        method: 'getNonConsoleCrumbs',
        expected: [...patchEvents([clickEvent]), expectedNav],
      },
      {
        method: 'getNavCrumbs',
        expected: [expectedNav],
      },
      {
        method: 'getNetworkSpans',
        expected: patchSpanEvents([navigationEvent]),
      },
      {
        method: 'getMemorySpans',
        expected: patchSpanEvents([secondMemory, secondMemory]),
      },
    ])('Calling $method will filter attachments', ({method, expected}) => {
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

    expect(replay?.sdkConfig()).toBe(optionsFrame);
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
