import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {useTimezone} from '@sentry/scraps/timezoneContext';

import {ConfigStore} from 'sentry/stores/configStore';

import {SentryTimezoneProvider} from './timezone';

describe('SentryTimezoneProvider', () => {
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

  it('provides the timezone configured by the user', () => {
    render(
      <SentryTimezoneProvider>
        <ShowTimezone data-test-id="tz" />
      </SentryTimezoneProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');
  });

  it('updates when the user timezone changes', () => {
    render(
      <SentryTimezoneProvider>
        <ShowTimezone data-test-id="tz" />
        <ChangeUserTimezone tz="America/Los_Angeles" />
      </SentryTimezoneProvider>
    );

    expect(screen.getByTestId('tz')).toHaveTextContent('America/New_York');

    screen.getByRole('button', {name: 'Change Timezone'}).click();
    expect(screen.getByTestId('tz')).toHaveTextContent('America/Los_Angeles');
  });
});
