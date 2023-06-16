import hydrateBreadcrumbs, {
  replayInitBreadcrumb,
} from 'sentry/utils/replays/hydrateBreadcrumbs';
import {BreadcrumbFrame} from 'sentry/utils/replays/types';

const ONE_DAY_MS = 60 * 60 * 24 * 1000;

describe('hydrateBreadcrumbs', () => {
  const replayRecord = TestStubs.ReplayRecord({started_at: new Date('2023/12/23')});

  it('should set the timestampMs and offsetMs for each breadcrumb in the list', () => {
    const breadcrumbs = [
      TestStubs.Replay.ConsoleFrame({timestamp: new Date('2023/12/23')}),
      TestStubs.Replay.ConsoleFrame({timestamp: new Date('2023/12/24')}),
      TestStubs.Replay.ConsoleFrame({timestamp: new Date('2023/12/25')}),
    ];

    expect(hydrateBreadcrumbs(replayRecord, breadcrumbs)).toStrictEqual([
      {
        category: 'console',
        data: {logger: 'unknown'},
        level: 'fatal',
        message: '',
        type: 'debug',
        timestamp: new Date('2023/12/23'),
        timestampMs: 1703307600000,
        offsetMs: 0,
      },
      {
        category: 'console',
        data: {logger: 'unknown'},
        level: 'fatal',
        message: '',
        type: 'debug',
        timestamp: new Date('2023/12/24'),
        timestampMs: 1703307600000 + ONE_DAY_MS,
        offsetMs: ONE_DAY_MS,
      },
      {
        category: 'console',
        data: {logger: 'unknown'},
        level: 'fatal',
        message: '',
        type: 'debug',
        timestamp: new Date('2023/12/25'),
        timestampMs: 1703307600000 + ONE_DAY_MS * 2,
        offsetMs: ONE_DAY_MS * 2,
      },
    ]);
  });

  it('should drop breadcrumbs that cannot be parsed', () => {
    const breadcrumbs = [{foo: 'bar'}];

    // @ts-expect-error: Explicitly test invalid input
    expect(hydrateBreadcrumbs(replayRecord, breadcrumbs)).toStrictEqual([]);
  });
});

describe('replayInitBreadcrumb', () => {
  it('should return a RecordingFrame', () => {
    const replayRecord = TestStubs.ReplayRecord({});

    const frame: BreadcrumbFrame = replayInitBreadcrumb(replayRecord);
    expect(frame).toStrictEqual({
      category: 'replay.init',
      message: 'http://localhost:3000/',
      offsetMs: 0,
      timestamp: replayRecord.started_at,
      timestampMs: 1663865919000,
      type: 'init',
    });
  });
});
