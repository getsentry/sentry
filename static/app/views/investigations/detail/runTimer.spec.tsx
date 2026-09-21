import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {InvestigationRunTimer} from 'sentry/views/investigations/detail/runTimer';
import {InvestigationOrchestrationFixture} from 'sentry/views/investigations/fixtures';

const timing = {
  startedAt: '2025-01-01T00:00:00Z',
  finishedAt: null,
  activeTimeElapsedSeconds: 24.5,
  activeSince: '2025-01-01T00:05:00Z',
  serverTime: '2025-01-01T00:05:10Z',
};

describe('InvestigationRunTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ticks from accumulated work plus the server interval despite clock skew or changes', () => {
    render(
      <InvestigationRunTimer orchestration={InvestigationOrchestrationFixture(timing)} />
    );
    expect(
      screen.getByRole('timer', {name: 'Investigation active time'})
    ).toHaveTextContent('34.5 s');
    act(() => jest.advanceTimersByTime(700));
    expect(screen.getByRole('timer')).toHaveTextContent('35.2 s');
    jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByRole('timer')).toHaveTextContent('35.5 s');
  });

  it('reanchors to fresh API data and preserves the duration after remounting', () => {
    const {rerender, unmount} = render(
      <InvestigationRunTimer orchestration={InvestigationOrchestrationFixture(timing)} />
    );
    act(() => jest.advanceTimersByTime(1000));
    const refreshed = InvestigationOrchestrationFixture({
      ...timing,
      serverTime: '2025-01-01T00:05:12Z',
    });
    rerender(<InvestigationRunTimer orchestration={refreshed} />);
    expect(screen.getByRole('timer')).toHaveTextContent('36.5 s');
    unmount();
    render(<InvestigationRunTimer orchestration={refreshed} />);
    expect(screen.getByRole('timer')).toHaveTextContent('36.5 s');
    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByRole('timer')).toHaveTextContent('37.0 s');
  });

  it('freezes throughout input waits and resumes without counting the wait', () => {
    const {rerender} = render(
      <InvestigationRunTimer orchestration={InvestigationOrchestrationFixture(timing)} />
    );
    act(() => jest.advanceTimersByTime(1000));
    const paused = InvestigationOrchestrationFixture({
      ...timing,
      status: 'awaiting_input',
      activeSince: null,
      activeTimeElapsedSeconds: 35.5,
      serverTime: '2025-01-01T00:05:11Z',
    });
    rerender(<InvestigationRunTimer orchestration={paused} />);
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByRole('timer')).toHaveTextContent('35.5 s');
    rerender(
      <InvestigationRunTimer
        orchestration={InvestigationOrchestrationFixture({
          ...timing,
          activeTimeElapsedSeconds: 35.5,
          activeSince: '2025-01-01T00:06:11Z',
          serverTime: '2025-01-01T00:06:11Z',
        })}
      />
    );
    expect(screen.getByRole('timer')).toHaveTextContent('35.5 s');
    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByRole('timer')).toHaveTextContent('36.0 s');
  });

  it.each(['completed', 'failed', 'cancelled'] as const)(
    'freezes on %s and resumes on retry',
    status => {
      const stopped = InvestigationOrchestrationFixture({
        ...timing,
        status,
        activeSince: null,
        activeTimeElapsedSeconds: 72,
        finishedAt: '2025-01-01T00:06:00Z',
      });
      const {rerender} = render(<InvestigationRunTimer orchestration={stopped} />);
      act(() => jest.advanceTimersByTime(60_000));
      expect(screen.getByRole('timer')).toHaveTextContent('1m 12s');
      rerender(
        <InvestigationRunTimer
          orchestration={InvestigationOrchestrationFixture({
            ...timing,
            generation: stopped.generation + 1,
            activeTimeElapsedSeconds: 72,
            activeSince: '2025-01-01T00:07:00Z',
            serverTime: '2025-01-01T00:07:00Z',
          })}
        />
      );
      act(() => jest.advanceTimersByTime(1000));
      expect(screen.getByRole('timer')).toHaveTextContent('1m 13s');
    }
  );

  it.each([
    {},
    {...timing, startedAt: null},
    {...timing, activeTimeElapsedSeconds: undefined},
    {...timing, activeTimeElapsedSeconds: -1},
    {...timing, activeTimeElapsedSeconds: Number.NaN},
    {...timing, activeSince: undefined},
    {...timing, serverTime: undefined},
    {...timing, serverTime: 'bad'},
    {...timing, activeSince: '2025-01-01T00:06:00Z'},
    {...timing, status: 'completed', finishedAt: null},
    {...timing, status: 'awaiting_input'},
    {...timing, finishedAt: '2025-01-01T00:06:00Z'},
  ])('omits unreliable timing: %j', overrides => {
    render(
      <InvestigationRunTimer
        orchestration={InvestigationOrchestrationFixture(overrides)}
      />
    );
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});
