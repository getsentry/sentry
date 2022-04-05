import LegacyConfigStore from 'sentry/stores/configStore';
import {
  configReducer,
  makeBridgableReducer,
} from 'sentry/stores/configStore/configReducer';

describe('configReducer', () => {
  it('sets value', () => {
    const state = TestStubs.Config();

    const newState = configReducer(state, {
      type: 'set config value',
      payload: {
        key: 'sentryConfig',
        value: {
          dsn: 'new dsn',
          whitelistUrls: ['new whitelist'],
          release: 'new release',
        },
      },
    });

    expect(newState.sentryConfig).toEqual({
      dsn: 'new dsn',
      whitelistUrls: ['new whitelist'],
      release: 'new release',
    });
  });

  it('sets theme', () => {
    const state = TestStubs.Config({theme: 'light'});

    const newState = configReducer(state, {
      type: 'set theme',
      payload: 'dark',
    });

    expect(newState.theme).toBe('dark');
  });

  it('patches state', () => {
    const state = TestStubs.Config({user: TestStubs.User({name: 'default user'})});

    const newState = configReducer(state, {
      type: 'patch',
      payload: {
        user: TestStubs.User({name: 'new user'}),
      },
    });

    expect(newState.user).toEqual(TestStubs.User({name: 'new user'}));
  });
});

describe('makeBridgableConfigReducer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
    LegacyConfigStore.teardown();
  });
  it('does not proxy to legacy store when bridging is disabled', () => {
    jest.useFakeTimers();

    const spy = jest.spyOn(LegacyConfigStore, 'set');
    const reducer = makeBridgableReducer(configReducer, false);

    reducer(LegacyConfigStore.config, {
      type: 'set config value',
      payload: {key: 'dsn', value: 'test dsn'},
    });

    jest.runAllTimers();
    expect(spy).not.toHaveBeenCalledWith('dsn', 'test dsn');
  });

  it('proxies to legacy store when bridging is enabled', async () => {
    jest.useFakeTimers();

    const spy = jest.spyOn(LegacyConfigStore, 'set');
    const reducer = makeBridgableReducer(configReducer, true);

    const newState = reducer(LegacyConfigStore.config, {
      type: 'set config value',
      payload: {key: 'dsn', value: 'test dsn'},
    });

    jest.runAllTimers();
    expect(spy).toHaveBeenCalledWith('dsn', 'test dsn');
    expect(newState).toEqual(LegacyConfigStore.config);
  });

  it('does not proxy patch actions when bridging is enabled', () => {
    jest.useFakeTimers();

    const spy = jest.spyOn(LegacyConfigStore, 'set');
    const reducer = makeBridgableReducer(configReducer, true);

    const state = TestStubs.Config({user: TestStubs.User({name: 'default user'})});
    reducer(state, {
      type: 'patch',
      payload: {
        user: TestStubs.User({name: 'new user'}),
      },
    });

    jest.runAllTimers();
    expect(spy).not.toHaveBeenCalled();
  });
});
