import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Clock24HoursProvider, useClock24Hours} from '@sentry/scraps/clock24HoursContext';

describe('clock24HoursContext', () => {
  function ShowClock24Hours(props: React.ComponentProps<'div'>) {
    const clock24Hours = useClock24Hours();
    return <div {...props}>{String(clock24Hours)}</div>;
  }

  it('defaults to a 12 hour clock when there is no provider', () => {
    render(<ShowClock24Hours data-test-id="clock" />);

    expect(screen.getByTestId('clock')).toHaveTextContent('false');
  });

  it('provides the clock preference', () => {
    render(
      <Clock24HoursProvider clock24Hours>
        <ShowClock24Hours data-test-id="clock" />
      </Clock24HoursProvider>
    );

    expect(screen.getByTestId('clock')).toHaveTextContent('true');
  });

  it('provides the innermost preference when nested', () => {
    render(
      <Clock24HoursProvider clock24Hours>
        <Clock24HoursProvider clock24Hours={false}>
          <ShowClock24Hours data-test-id="clock" />
        </Clock24HoursProvider>
      </Clock24HoursProvider>
    );

    expect(screen.getByTestId('clock')).toHaveTextContent('false');
  });
});
