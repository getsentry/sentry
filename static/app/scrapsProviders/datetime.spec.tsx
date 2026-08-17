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

  function ShowTimezone(props: React.ComponentProps<'div'>) {
    const timezone = useTimezone();
    return <div {...props}>{timezone}</div>;
  }

  function ShowClockDisplay(props: React.ComponentProps<'div'>) {
    const clockDisplay = useClockDisplay();
    return <div {...props}>{clockDisplay}</div>;
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
        <ShowTimezone data-test-id="tz" />
      </SentryDateTimeProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');
  });

  it('updates when the user timezone changes', () => {
    render(
      <SentryDateTimeProvider>
        <ShowTimezone data-test-id="tz" />
        <ChangeUserTimezone tz="America/Los_Angeles" />
      </SentryDateTimeProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');

    screen.getByRole('button', {name: 'Change Timezone'}).click();
    expect(screen.getByTestId('tz')).toHaveTextContent('America/Los_Angeles');
  });

  it('maps the user 24 hour option onto the clock display', () => {
    setConfigStoreUser({clock24Hours: true});

    render(
      <SentryDateTimeProvider>
        <ShowClockDisplay data-test-id="clock" />
      </SentryDateTimeProvider>
    );

    expect(screen.getByTestId('clock')).toHaveTextContent('24');
  });

  it('falls back to a 12 hour clock', () => {
    setConfigStoreUser({clock24Hours: false});

    render(
      <SentryDateTimeProvider>
        <ShowClockDisplay data-test-id="clock" />
      </SentryDateTimeProvider>
    );

    expect(screen.getByTestId('clock')).toHaveTextContent('12');
  });
});
