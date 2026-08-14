import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {useClock24Hours} from '@sentry/scraps/clock24HoursContext';
import {useTimezone} from '@sentry/scraps/timezoneContext';

import {ConfigStore} from 'sentry/stores/configStore';

import {SentryTimeFormatProvider} from './timeFormat';

describe('SentryTimeFormatProvider', () => {
  function setConfigStoreTimezone(tz: string) {
    const user = UserFixture();
    user.options.timezone = tz;
    act(() => ConfigStore.set('user', user));
  }

  function setConfigStoreClock24Hours(clock24Hours: boolean) {
    const user = UserFixture();
    user.options.clock24Hours = clock24Hours;
    act(() => ConfigStore.set('user', user));
  }

  function ShowTimezone(props: React.ComponentProps<'div'>) {
    const timezone = useTimezone();
    return <div {...props}>{timezone}</div>;
  }

  function ShowClock24Hours(props: React.ComponentProps<'div'>) {
    const clock24Hours = useClock24Hours();
    return <div {...props}>{String(clock24Hours)}</div>;
  }

  function ChangeUserTimezone({tz}: {tz: string}) {
    return <button onClick={() => setConfigStoreTimezone(tz)}>Change Timezone</button>;
  }

  beforeEach(() => setConfigStoreTimezone('America/New_York'));

  it('provides the timezone configured by the user', () => {
    render(
      <SentryTimeFormatProvider>
        <ShowTimezone data-test-id="tz" />
      </SentryTimeFormatProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');
  });

  it('updates when the user timezone changes', () => {
    render(
      <SentryTimeFormatProvider>
        <ShowTimezone data-test-id="tz" />
        <ChangeUserTimezone tz="America/Los_Angeles" />
      </SentryTimeFormatProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');

    screen.getByRole('button', {name: 'Change Timezone'}).click();
    expect(screen.getByTestId('tz')).toHaveTextContent('America/Los_Angeles');
  });

  it('provides the clock preference configured by the user', () => {
    setConfigStoreClock24Hours(true);

    render(
      <SentryTimeFormatProvider>
        <ShowClock24Hours data-test-id="clock" />
      </SentryTimeFormatProvider>
    );

    expect(screen.getByTestId('clock')).toHaveTextContent('true');
  });

  it('defaults the clock preference to a 12 hour clock', () => {
    setConfigStoreClock24Hours(false);

    render(
      <SentryTimeFormatProvider>
        <ShowClock24Hours data-test-id="clock" />
      </SentryTimeFormatProvider>
    );

    expect(screen.getByTestId('clock')).toHaveTextContent('false');
  });
});
