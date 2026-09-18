import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {InvestigationRunTimer} from 'sentry/views/investigations/detail/runTimer';

describe('InvestigationRunTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-13T20:00:30Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts up from the start time', () => {
    render(<InvestigationRunTimer startedAt="2026-08-13T20:00:00Z" />);

    expect(screen.getByRole('timer')).toHaveTextContent('0:30');

    act(() => {
      jest.advanceTimersByTime(31_000);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('1:01');
  });

  it('renders nothing for an unusable or future start time', () => {
    const {rerender} = render(<InvestigationRunTimer startedAt="not-a-date" />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    rerender(<InvestigationRunTimer startedAt="2026-08-13T21:00:00Z" />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});
