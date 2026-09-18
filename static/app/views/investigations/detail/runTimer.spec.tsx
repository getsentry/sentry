import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {InvestigationRunTimer} from 'sentry/views/investigations/detail/runTimer';

describe('InvestigationRunTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-13T20:00:30.400Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts up in tenths of a second while the run is going', () => {
    render(<InvestigationRunTimer startedAt="2026-08-13T20:00:00Z" />);

    expect(screen.getByText('Running for')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('30.4s');

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('31.1s');
  });

  it('freezes at the total once the run has ended', () => {
    render(
      <InvestigationRunTimer
        startedAt="2026-08-13T20:00:00Z"
        endedAt="2026-08-13T20:00:12.300Z"
      />
    );

    expect(screen.getByText('Total time')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('12.3s');

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('12.3s');
  });

  it('renders nothing for an unusable or future start time', () => {
    const {rerender} = render(<InvestigationRunTimer startedAt="not-a-date" />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    rerender(<InvestigationRunTimer startedAt="2026-08-13T21:00:00Z" />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});
