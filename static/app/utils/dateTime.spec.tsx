import {Fragment} from 'react';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  DateTime,
  formatDateTime,
  getFormat,
  useClockDisplay,
  useTimezone,
} from '@sentry/scraps/dateTime';

import {ConfigStore} from 'sentry/stores/configStore';

describe('shared date configuration', () => {
  function setConfigStoreUser({
    timezone = 'America/New_York',
    clock24Hours = false,
  } = {}) {
    const user = UserFixture();
    user.options.timezone = timezone;
    user.options.clock24Hours = clock24Hours;
    act(() => ConfigStore.set('user', user));
  }

  function ShowTimezone() {
    const timezone = useTimezone();
    return <div>{timezone}</div>;
  }

  function ShowClockDisplay() {
    const clockDisplay = useClockDisplay();
    return <div>{`${clockDisplay} hour clock`}</div>;
  }

  function ChangeUserTimezone({tz}: {tz: string}) {
    return (
      <button onClick={() => setConfigStoreUser({timezone: tz})}>Change Timezone</button>
    );
  }

  beforeEach(() => setConfigStoreUser());

  it('provides the timezone configured by the user', () => {
    render(<ShowTimezone />);

    expect(screen.getByText('America/New_York')).toBeInTheDocument();
  });

  it('updates when the user timezone changes', async () => {
    render(
      <Fragment>
        <ShowTimezone />
        <ChangeUserTimezone tz="America/Los_Angeles" />
      </Fragment>
    );

    expect(screen.getByText('America/New_York')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Change Timezone'}));
    expect(screen.getByText('America/Los_Angeles')).toBeInTheDocument();
  });

  it('maps the user 24 hour option onto the clock display', () => {
    setConfigStoreUser({clock24Hours: true});

    render(<ShowClockDisplay />);

    expect(screen.getByText('24 hour clock')).toBeInTheDocument();
  });

  it('falls back to a 12 hour clock', () => {
    setConfigStoreUser({});

    render(<ShowClockDisplay />);

    expect(screen.getByText('12 hour clock')).toBeInTheDocument();
  });
});

it('keeps plain formatters and React dates in sync with live application preferences', () => {
  const date = '2026-01-01T23:45:00Z';
  const user = UserFixture();
  user.options.timezone = 'America/New_York';
  user.options.clock24Hours = false;
  act(() => ConfigStore.set('user', user));
  render(<DateTime date={date} timeOnly />);
  expect(screen.getByText('6:45 PM')).toBeInTheDocument();
  expect(formatDateTime(date, {timeOnly: true})).toBe('6:45 PM');
  expect(getFormat({timeOnly: true})).toBe('LT');

  act(() =>
    ConfigStore.set('user', {
      ...user,
      options: {...user.options, timezone: 'UTC', clock24Hours: true},
    })
  );
  expect(screen.getByText('23:45')).toBeInTheDocument();
  expect(formatDateTime(date, {timeOnly: true})).toBe('23:45');
  expect(getFormat({timeOnly: true})).toBe('HH:mm');
});
