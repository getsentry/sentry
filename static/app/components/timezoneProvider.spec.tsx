import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {TimezoneProvider, UserTimezoneProvider, useTimezone} from './timezoneProvider';

describe('timezoneProvider', function () {
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

  describe('TimezoneProvider', function () {
    it('provides the timezone value', function () {
      render(
        <TimezoneProvider timezone="America/Halifax">
          <ShowTimezone data-test-id="tz" />
        </TimezoneProvider>
      );

      expect(screen.getByTestId('tz')).toHaveTextContent('America/Halifax');
    });
  });

  describe('UserTimezoneProvider', function () {
    it('provides timezone for the user', function () {
      render(
        <UserTimezoneProvider>
          <ShowTimezone data-test-id="tz" />
        </UserTimezoneProvider>
      );

      expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');
    });

    it('updates when the user timezone changes', function () {
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
