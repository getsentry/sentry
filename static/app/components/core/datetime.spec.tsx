import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider, useClockDisplay, useTimezone} from '@sentry/scraps/datetime';

describe('datetime', () => {
  function ShowDateTime() {
    const timezone = useTimezone();
    const clockDisplay = useClockDisplay();
    return <div>{`${timezone} / ${clockDisplay}`}</div>;
  }

  it('defaults to UTC on a 12 hour clock when there is no provider', () => {
    render(<ShowDateTime />);

    expect(screen.getByText('UTC / 12')).toBeInTheDocument();
  });

  it('provides the value', () => {
    render(
      <DateTimeProvider value={{timezone: 'America/Halifax', clockDisplay: '24'}}>
        <ShowDateTime />
      </DateTimeProvider>
    );

    expect(screen.getByText('America/Halifax / 24')).toBeInTheDocument();
  });

  it('provides the innermost value when nested', () => {
    render(
      <DateTimeProvider value={{timezone: 'America/Halifax', clockDisplay: '24'}}>
        <DateTimeProvider value={{timezone: 'Australia/Eucla', clockDisplay: '12'}}>
          <ShowDateTime />
        </DateTimeProvider>
      </DateTimeProvider>
    );

    expect(screen.getByText('Australia/Eucla / 12')).toBeInTheDocument();
  });
});
