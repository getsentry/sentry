import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

describe('useIsSentryEmployee', () => {
  it('should return true if the user is a Sentry employee', () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          emails: [
            {
              email: 'jenn@sentry.io',
              is_verified: true,
              id: '1',
            },
          ],
        }),
      })
    );

    const {result} = renderHook(() => useIsSentryEmployee());

    expect(result.current).toBe(true);
  });

  it('should return false if the user is not a Sentry employee', () => {
    // Mock ConfigStore to simulate a non-Sentry employee
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          emails: [
            {
              email: 'jenn@not-sentry.com',
              is_verified: true,
              id: '1',
            },
          ],
        }),
      })
    );

    const {result} = renderHook(() => useIsSentryEmployee());

    expect(result.current).toBe(false);
  });

  it('should return false if the email is not verified', () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          emails: [
            {
              email: 'jenn@sentry.io',
              is_verified: false,
              id: '1',
            },
          ],
        }),
      })
    );

    const {result} = renderHook(() => useIsSentryEmployee());

    expect(result.current).toBe(false);
  });
});
