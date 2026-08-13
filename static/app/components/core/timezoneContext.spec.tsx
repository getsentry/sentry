import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TimezoneProvider, useTimezone} from '@sentry/scraps/timezoneContext';

describe('timezoneContext', () => {
  function ShowTimezone(props: React.ComponentProps<'div'>) {
    const timezone = useTimezone();
    return <div {...props}>{timezone}</div>;
  }

  it('defaults to UTC when there is no provider', () => {
    render(<ShowTimezone data-test-id="tz" />);

    expect(screen.getByTestId('tz')).toHaveTextContent('UTC');
  });

  it('provides the timezone value', () => {
    render(
      <TimezoneProvider timezone="America/Halifax">
        <ShowTimezone data-test-id="tz" />
      </TimezoneProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('America/Halifax');
  });

  it('provides the innermost timezone when nested', () => {
    render(
      <TimezoneProvider timezone="America/Halifax">
        <TimezoneProvider timezone="Australia/Eucla">
          <ShowTimezone data-test-id="tz" />
        </TimezoneProvider>
      </TimezoneProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('Australia/Eucla');
  });
});
