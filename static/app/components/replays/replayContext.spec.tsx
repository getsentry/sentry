import {ReplayerEvents} from '@sentry-internal/rrweb';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import {ReplayReader} from 'sentry/utils/replays/replayReader';
import {EventType} from 'sentry/utils/replays/types';

const mockPause = jest.fn();
const mockPlay = jest.fn();
const mockVideoPause = jest.fn();
const mockVideoPlay = jest.fn();
const mockReplayerHandlers = new Map<string, (arg: any) => void>();

jest.mock('@sentry-internal/rrweb', () => {
  const actual = jest.requireActual('@sentry-internal/rrweb');
  return {
    ...actual,
    Replayer: jest.fn().mockImplementation(() => ({
      config: {skipInactive: false, speed: 1},
      destroy: jest.fn(),
      getCurrentTime: () => 0,
      getMirror: () => null,
      iframe: document.createElement('iframe'),
      on: jest.fn((event: string, handler: (arg: any) => void) => {
        mockReplayerHandlers.set(event, handler);
      }),
      pause: mockPause,
      play: mockPlay,
      setConfig: jest.fn(),
      wrapper: document.createElement('div'),
    })),
  };
});

jest.mock('sentry/components/replays/videoReplayerWithInteractions', () => ({
  VideoReplayerWithInteractions: jest.fn().mockImplementation(() => ({
    config: {skipInactive: false, speed: 1},
    destroy: jest.fn(),
    getCurrentTime: () => 0,
    pause: mockVideoPause,
    play: mockVideoPlay,
    setConfig: jest.fn(),
  })),
}));

const startedAt = new Date('2023-12-25T00:00:00');

function TestPlayer() {
  const {fastForwardSpeed, setRoot, togglePlayPause} = useReplayContext();

  return (
    <div ref={setRoot}>
      <button onClick={() => togglePlayPause(true)}>Play</button>
      <button onClick={() => togglePlayPause(false)}>Pause</button>
      <span>Fast forward: {fastForwardSpeed}</span>
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

function renderPlayer({video}: {video?: boolean} = {}) {
  const replay = ReplayReader.factory({
    attachments: video
      ? [VideoFrameEventFixture()]
      : RRWebInitFrameEventsFixture({timestamp: startedAt}),
    errors: [],
    fetching: false,
    replayRecord: ReplayRecordFixture({started_at: startedAt}),
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
  afterEach(() => {
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

  it('keeps the fast forward speed when the tab stays visible while skipping', async () => {
    renderPlayer();
    await startPlaying();
    startFastForwarding();

    setVisibility('visible');

    expect(screen.getByText('Fast forward: 8')).toBeInTheDocument();
  });
});
