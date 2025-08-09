import {Fragment} from 'react';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {
  OverrideTimezoneProvider,
  TimezoneProvider,
  UserTimezoneProvider,
  useTimezone,
  useTimezoneOverride,
} from './timezoneProvider';

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

  function OverrideTimezone({tz}: {tz: string}) {
    const {setOverride, clearOverride} = useTimezoneOverride();

    return (
      <Fragment>
        <button onClick={() => setOverride(tz)}>Override Timezone</button>
        <button onClick={() => clearOverride()}>Reset Timezone</button>
      </Fragment>
    );
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

  describe('OverrideTimezoneProvider', function () {
    it('can override timezones', function () {
      render(
        <UserTimezoneProvider>
          <ShowTimezone data-test-id="tz-outer" />
          <OverrideTimezoneProvider>
            <ShowTimezone data-test-id="tz-inner" />
            <OverrideTimezone tz="America/Los_Angeles" />
          </OverrideTimezoneProvider>
        </UserTimezoneProvider>
      );

      expect(screen.getByTestId('tz-outer')).toHaveTextContent('America/New_York');

      // Act because useOverrideTimezone is an effect
      act(() => screen.getByRole('button', {name: 'Override Timezone'}).click());
      expect(screen.getByTestId('tz-outer')).toHaveTextContent('America/New_York');
      expect(screen.getByTestId('tz-inner')).toHaveTextContent('America/Los_Angeles');

      // Act because useOverrideTimezone is an effect
      act(() => screen.getByRole('button', {name: 'Reset Timezone'}).click());
      expect(screen.getByTestId('tz-outer')).toHaveTextContent('America/New_York');
      expect(screen.getByTestId('tz-inner')).toHaveTextContent('America/New_York');
    });
  });
});
