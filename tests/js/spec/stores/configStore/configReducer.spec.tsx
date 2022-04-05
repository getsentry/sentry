import {configReducer} from 'sentry/stores/configStore/configReducer';

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
});
