import {Replayer, ReplayerEvents} from '@sentry/rrweb';
import {RawReplayErrorFixture} from 'sentry-fixture/replay/error';
import {
  RRWebFullSnapshotFrameEventFixture,
  RRWebInitFrameEventsFixture,
} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {mockAnimationFrame} from 'sentry-test/mockAnimationFrame';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import {ReplayReader} from 'sentry/utils/replays/replayReader';
import type {RawReplayError, RecordingFrame} from 'sentry/utils/replays/types';
import {EventType} from 'sentry/utils/replays/types';

const mockPause = jest.fn();
const mockPlay = jest.fn();
const mockVideoPause = jest.fn();
const mockVideoPlay = jest.fn();
const mockGetCurrentTime = jest.fn(() => 0);
const mockReplayerHandlers = new Map<string, (arg: any) => void>();

jest.mock('@sentry/rrweb', () => {
  const actual = jest.requireActual('@sentry/rrweb');
  return {
    ...actual,
    Replayer: jest
      .fn()
      .mockImplementation((events: RecordingFrame[], {root}: {root: HTMLElement}) => {
        const wrapper = document.createElement('div');
        root.appendChild(wrapper);
        return {
          config: {skipInactive: false, speed: 1},
          destroy: jest.fn(),
          getCurrentTime: mockGetCurrentTime,
          getMirror: () => null,
          iframe: document.createElement('iframe'),
          on: jest.fn((event: string, handler: (arg: any) => void) => {
            mockReplayerHandlers.set(event, handler);
          }),
          pause: mockPause,
          play: (timeOffset?: number) => {
            // rrweb's `play` writes `delay` onto the events it was given
            for (const event of events) {
              event.delay = event.timestamp - events[0]!.timestamp;
            }
            mockPlay(timeOffset);
          },
          setConfig: jest.fn(),
          wrapper,
        };
      }),
  };
});

jest.mock('sentry/components/replays/videoReplayerWithInteractions', () => ({
  VideoReplayerWithInteractions: jest.fn().mockImplementation(() => ({
    config: {skipInactive: false, speed: 1},
    destroy: jest.fn(),
    getCurrentTime: mockGetCurrentTime,
    pause: mockVideoPause,
    play: mockVideoPlay,
    setConfig: jest.fn(),
  })),
}));

const startedAt = new Date('2023-12-25T00:00:00');

function TestPlayer() {
  const {currentTime, fastForwardSpeed, setRoot, togglePlayPause} = useReplayContext();

  return (
    <div ref={setRoot}>
      <button onClick={() => togglePlayPause(true)}>Play</button>
      <button onClick={() => togglePlayPause(false)}>Pause</button>
      <span>Fast forward: {fastForwardSpeed}</span>
      <span>Current time: {currentTime}</span>
    </div>
  );
}

function VideoFrameEventFixture() {
  return {
    type: EventType.Custom,
    timestamp: startedAt.getTime(),
    data: {
      tag: 'video',
      payload: {duration: 5_000, segmentId: 0},
    },
  };
}

function makeReader({
  attachments,
  errors = [],
  finishedAt,
}: {
  attachments: unknown[];
  errors?: RawReplayError[];
  finishedAt?: Date;
}) {
  return ReplayReader.factory({
    attachments,
    errors,
    fetching: false,
    replayRecord: ReplayRecordFixture({
      started_at: startedAt,
      ...(finishedAt && {finished_at: finishedAt}),
    }),
  });
}

function renderPlayer({video}: {video?: boolean} = {}) {
  const replay = makeReader({
    attachments: video
      ? [VideoFrameEventFixture()]
      : RRWebInitFrameEventsFixture({timestamp: startedAt}),
  });

  return render(
    <ReplayContextProvider analyticsContext="" isFetching={false} replay={replay}>
      <TestPlayer />
    </ReplayContextProvider>
  );
}

async function startPlaying() {
  await userEvent.click(screen.getByRole('button', {name: 'Play'}));
  // Starting playback also seeks, which is not what these tests are about
  jest.clearAllMocks();
}

function startFastForwarding() {
  act(() => {
    mockReplayerHandlers.get(ReplayerEvents.SkipStart)?.({speed: 8});
  });
}

function setVisibility(visibilityState: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('replayContext', () => {
  it.each([false, true])(
    'keeps polling the player after an unchanged timestamp (video: %s)',
    video => {
      const {advanceFrame, frames} = mockAnimationFrame();
      const replay = makeReader({
        attachments: video
          ? [VideoFrameEventFixture()]
          : RRWebInitFrameEventsFixture({timestamp: startedAt}),
      });
      const {unmount} = render(
        <ReplayContextProvider analyticsContext="" isFetching={false} replay={replay}>
          <TestPlayer />
        </ReplayContextProvider>
      );

      advanceFrame();
      mockGetCurrentTime.mockReturnValue(1_000);
      advanceFrame();
      expect(screen.getByText('Current time: 1000')).toBeInTheDocument();

      // Polling must also survive an unchanged clock after a React render.
      advanceFrame();
      mockGetCurrentTime.mockReturnValue(2_000);
      advanceFrame();
      expect(screen.getByText('Current time: 2000')).toBeInTheDocument();

      unmount();
      expect(frames.size).toBe(0);
    }
  );

  afterEach(() => {
    mockGetCurrentTime.mockReturnValue(0);
    jest.restoreAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('pauses without seeking when the tab is hidden while playing', async () => {
    renderPlayer();
    await startPlaying();

    setVisibility('hidden');

    expect(mockPause).toHaveBeenCalledWith();
  });

  it('pauses with the current time when the tab is hidden during a video replay', async () => {
    renderPlayer({video: true});
    await startPlaying();

    setVisibility('hidden');

    expect(mockVideoPause).toHaveBeenCalledWith(expect.any(Number));
  });

  it('does not pause when the tab becomes visible while playing', async () => {
    renderPlayer();
    await startPlaying();

    setVisibility('visible');

    expect(mockPause).not.toHaveBeenCalled();
  });

  it('does not pause when the tab is hidden while already paused', () => {
    renderPlayer();

    setVisibility('hidden');

    expect(mockPause).not.toHaveBeenCalled();
  });

  it('seeks to the current time when the user pauses', async () => {
    renderPlayer();
    await startPlaying();

    await userEvent.click(screen.getByRole('button', {name: 'Pause'}));

    expect(mockPause).toHaveBeenCalledWith(expect.any(Number));
  });

  it('seeks to the current time when the user plays', async () => {
    renderPlayer();

    await userEvent.click(screen.getByRole('button', {name: 'Play'}));

    expect(mockPlay).toHaveBeenCalledWith(expect.any(Number));
  });

  it('clears the fast forward speed when the tab is hidden while skipping', async () => {
    renderPlayer();
    await startPlaying();
    startFastForwarding();

    setVisibility('hidden');

    expect(screen.getByText('Fast forward: 0')).toBeInTheDocument();
  });

  it('keeps the player when the reader is rebuilt over the same recording', () => {
    const attachments = RRWebInitFrameEventsFixture({timestamp: startedAt});
    const {rerender} = render(
      <ReplayContextProvider
        analyticsContext=""
        isFetching={false}
        replay={makeReader({attachments})}
      >
        <TestPlayer />
      </ReplayContextProvider>
    );

    rerender(
      <ReplayContextProvider
        analyticsContext=""
        isFetching={false}
        replay={makeReader({
          attachments,
          errors: [RawReplayErrorFixture({timestamp: startedAt})],
        })}
      >
        <TestPlayer />
      </ReplayContextProvider>
    );

    expect(Replayer).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['at the start of the replay', startedAt],
    ['after the start of the replay', new Date(startedAt.getTime() + 1_000)],
  ])(
    'keeps the player when the reader is rebuilt during playback of a recording that begins %s',
    async (_, recordingStartedAt) => {
      const attachments = [
        ...RRWebInitFrameEventsFixture({timestamp: recordingStartedAt}),
        RRWebFullSnapshotFrameEventFixture({timestamp: recordingStartedAt}),
      ];
      const {rerender} = render(
        <ReplayContextProvider
          analyticsContext=""
          isFetching={false}
          replay={makeReader({attachments})}
        >
          <TestPlayer />
        </ReplayContextProvider>
      );
      await userEvent.click(screen.getByRole('button', {name: 'Play'}));

      rerender(
        <ReplayContextProvider
          analyticsContext=""
          isFetching={false}
          replay={makeReader({
            attachments,
            errors: [RawReplayErrorFixture({timestamp: startedAt})],
          })}
        >
          <TestPlayer />
        </ReplayContextProvider>
      );

      expect(Replayer).toHaveBeenCalledTimes(1);
    }
  );

  it('rebuilds the player during playback when the recording end changes', async () => {
    const attachments = [
      ...RRWebInitFrameEventsFixture({timestamp: startedAt}),
      RRWebFullSnapshotFrameEventFixture({timestamp: startedAt}),
    ];
    const {rerender} = render(
      <ReplayContextProvider
        analyticsContext=""
        isFetching={false}
        replay={makeReader({
          attachments,
          finishedAt: new Date(startedAt.getTime() + 5_000),
        })}
      >
        <TestPlayer />
      </ReplayContextProvider>
    );
    await userEvent.click(screen.getByRole('button', {name: 'Play'}));

    rerender(
      <ReplayContextProvider
        analyticsContext=""
        isFetching={false}
        replay={makeReader({
          attachments,
          finishedAt: new Date(startedAt.getTime() + 10_000),
        })}
      >
        <TestPlayer />
      </ReplayContextProvider>
    );

    expect(Replayer).toHaveBeenCalledTimes(2);
  });

  it('rebuilds the player when the recording gains frames', () => {
    const attachments = RRWebInitFrameEventsFixture({timestamp: startedAt});
    const {rerender} = render(
      <ReplayContextProvider
        analyticsContext=""
        isFetching={false}
        replay={makeReader({attachments})}
      >
        <TestPlayer />
      </ReplayContextProvider>
    );

    rerender(
      <ReplayContextProvider
        analyticsContext=""
        isFetching={false}
        replay={makeReader({
          attachments: [
            ...attachments,
            RRWebFullSnapshotFrameEventFixture({timestamp: startedAt}),
          ],
        })}
      >
        <TestPlayer />
      </ReplayContextProvider>
    );

    expect(Replayer).toHaveBeenCalledTimes(2);
  });

  it('keeps the fast forward speed when the tab stays visible while skipping', async () => {
    renderPlayer();
    await startPlaying();
    startFastForwarding();

    setVisibility('visible');

    expect(screen.getByText('Fast forward: 8')).toBeInTheDocument();
  });
});
