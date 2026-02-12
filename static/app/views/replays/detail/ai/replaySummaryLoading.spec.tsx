import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {REPLAY_SUMMARY_PROCESSING_MESSAGES} from 'sentry/views/replays/detail/ai/utils';

import {ReplaySummaryLoading} from './replaySummaryLoading';

describe('ReplaySummaryLoading', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the first processing message', () => {
    render(<ReplaySummaryLoading />);
    expect(screen.getByText(REPLAY_SUMMARY_PROCESSING_MESSAGES[0]!)).toBeInTheDocument();
  });

  it('rotates to the next message after the initial delay', () => {
    render(<ReplaySummaryLoading />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.getByText(REPLAY_SUMMARY_PROCESSING_MESSAGES[1]!)).toBeInTheDocument();
  });

  it('does not show the first message after rotation', () => {
    render(<ReplaySummaryLoading />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(
      screen.queryByText(REPLAY_SUMMARY_PROCESSING_MESSAGES[0]!)
    ).not.toBeInTheDocument();
  });
});
