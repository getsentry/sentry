import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider, useClockDisplay, useTimezone} from '@sentry/scraps/datetime';

describe('datetime', () => {
  function ShowDateTime(props: React.ComponentProps<'div'>) {
    const timezone = useTimezone();
    const clockDisplay = useClockDisplay();
    return <div {...props}>{`${timezone} / ${clockDisplay}`}</div>;
  }

  it('defaults to UTC on a 12 hour clock when there is no provider', () => {
    render(<ShowDateTime data-test-id="dt" />);

    expect(screen.getByTestId('dt')).toHaveTextContent('UTC / 12');
  });

  it('provides the value', () => {
    render(
      <DateTimeProvider value={{timezone: 'America/Halifax', clockDisplay: '24'}}>
        <ShowDateTime data-test-id="dt" />
      </DateTimeProvider>
    );

    expect(screen.getByTestId('dt')).toHaveTextContent('America/Halifax / 24');
  });

  it('provides the innermost value when nested', () => {
    render(
      <DateTimeProvider value={{timezone: 'America/Halifax', clockDisplay: '24'}}>
        <DateTimeProvider value={{timezone: 'Australia/Eucla', clockDisplay: '12'}}>
          <ShowDateTime data-test-id="dt" />
        </DateTimeProvider>
      </DateTimeProvider>
    );

    expect(screen.getByTestId('dt')).toHaveTextContent('Australia/Eucla / 12');
  });
});
