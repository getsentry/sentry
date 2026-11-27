import {act, fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type {ReplayReader} from 'sentry/utils/replays/replayReader';

import {PlayerScrubber} from './scrubber';

jest.mock('sentry/components/replays/replayContext');
jest.mock('sentry/utils/replays/playback/providers/replayReaderProvider');

const mockSetCurrentTime = jest.fn();

describe('Scrubber', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSetCurrentTime.mockReset();
    jest.mocked(useReplayContext).mockReturnValue({
      currentTime: 0,
      setCurrentTime: mockSetCurrentTime,
    } as unknown as ReturnType<typeof useReplayContext>);
    jest.mocked(useReplayReader).mockReturnValue({
      getDurationMs: () => 100_000,
    } as unknown as ReplayReader);
  });

  afterEach(() => {
    try {
      act(() => {
        jest.runOnlyPendingTimers();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('seeks outside the input event and coalesces a drag into one seek', () => {
    render(<PlayerScrubber />);
    const slider = screen.getByRole('slider', {name: 'Seek slider'});

    for (let value = 1_000; value <= 60_000; value += 1_000) {
      fireEvent.change(slider, {target: {value: String(value)}});
    }

    expect(mockSetCurrentTime).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(16));

    expect(mockSetCurrentTime).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentTime).toHaveBeenCalledWith(60_000);
  });
});
