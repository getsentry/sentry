import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {useClockDisplay, useTimezone} from '@sentry/scraps/datetime';

import {ConfigStore} from 'sentry/stores/configStore';

import {SentryDateTimeProvider} from './datetime';

describe('SentryDateTimeProvider', () => {
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
    render(
      <SentryDateTimeProvider>
        <ShowTimezone />
      </SentryDateTimeProvider>
    );

    expect(screen.getByText('America/New_York')).toBeInTheDocument();
  });

  it('updates when the user timezone changes', () => {
    render(
      <SentryDateTimeProvider>
        <ShowTimezone />
        <ChangeUserTimezone tz="America/Los_Angeles" />
      </SentryDateTimeProvider>
    );

    expect(screen.getByText('America/New_York')).toBeInTheDocument();

    screen.getByRole('button', {name: 'Change Timezone'}).click();
    expect(screen.getByText('America/Los_Angeles')).toBeInTheDocument();
  });

  it('maps the user 24 hour option onto the clock display', () => {
    setConfigStoreUser({clock24Hours: true});

    render(
      <SentryDateTimeProvider>
        <ShowClockDisplay />
      </SentryDateTimeProvider>
    );

    expect(screen.getByText('24 hour clock')).toBeInTheDocument();
  });

  it('falls back to a 12 hour clock', () => {
    setConfigStoreUser({clock24Hours: false});

    render(
      <SentryDateTimeProvider>
        <ShowClockDisplay />
      </SentryDateTimeProvider>
    );

    expect(screen.getByText('12 hour clock')).toBeInTheDocument();
  });
});
