import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {TimezoneProvider, UserTimezoneProvider, useTimezone} from './timezoneProvider';

describe('timezoneProvider', () => {
  function setConfigStoreTimezone(tz: string) {
    const user = UserFixture();
    user.options.timezone = tz;
    act(() => ConfigStore.set('user', user));
  }

  function ShowTimezone(props: React.ComponentProps<'div'>) {
    const timezone = useTimezone();
    return <div {...props}>{timezone}</div>;
  }

  function ChangeUserTimezone({tz}: {tz: string}) {
    return <button onClick={() => setConfigStoreTimezone(tz)}>Change Timezone</button>;
  }

  beforeEach(() => setConfigStoreTimezone('America/New_York'));

  describe('TimezoneProvider', () => {
    it('provides the timezone value', () => {
      render(
        <TimezoneProvider timezone="America/Halifax">
          <ShowTimezone data-test-id="tz" />
        </TimezoneProvider>
      );

      expect(screen.getByTestId('tz')).toHaveTextContent('America/Halifax');
    });
  });

  describe('UserTimezoneProvider', () => {
    it('provides timezone for the user', () => {
      render(
        <UserTimezoneProvider>
          <ShowTimezone data-test-id="tz" />
        </UserTimezoneProvider>
      );

      expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');
    });

    it('updates when the user timezone changes', () => {
      render(
        <UserTimezoneProvider>
          <ShowTimezone data-test-id="tz" />
          <ChangeUserTimezone tz="America/Los_Angeles" />
        </UserTimezoneProvider>
      );

      expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');

      screen.getByRole('button', {name: 'Change Timezone'}).click();
      expect(screen.getByTestId('tz')).toHaveTextContent('America/Los_Angeles');
    });
  });
});
