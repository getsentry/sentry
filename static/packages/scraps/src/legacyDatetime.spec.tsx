import {render, screen} from '@testing-library/react';

import {DateTimeProvider, useClockDisplay, useTimezone} from './legacyDatetime';

it('maps the 0.5.0 provider value onto the current preferences', () => {
  function Preferences() {
    return (
      <span>
        {useTimezone()} {useClockDisplay()}
      </span>
    );
  }
  render(
    <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '24'}}>
      <Preferences />
    </DateTimeProvider>
  );
  expect(screen.getByText('America/New_York 24')).toBeInTheDocument();
});
