import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {getLocalityUrlOptions, getLocalityNameOptions} from 'sentry/utils/cells';

describe('getLocalityUrlOptions', () => {
  let configstate: Config;

  beforeEach(() => {
    configstate = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configstate);
  });

  it('filters out excluded names', () => {
    ConfigStore.set('localities', [
      {name: 'us', url: 'https://us.sentry.io'},
      {name: 'de', url: 'https://de.sentry.io'},
      {name: 'ja', url: 'https://ja.sentry.io'},
    ]);

    const res = getLocalityUrlOptions([
      {name: 'us', url: 'https://us.sentry.io', displayName: 'us', label: 'us'},
    ]);
    expect(res).toHaveLength(2);
    expect(res[0]).toEqual({
      value: 'https://de.sentry.io',
      label: '🇪🇺 European Union (EU)',
    });
    expect(res[1]).toEqual({value: 'https://ja.sentry.io', label: 'ja'});

    // Excluding the only included option = empty set.
    const none = getLocalityUrlOptions(
      [{name: 'us', url: 'https://us.sentry.io', displayName: 'us', label: 'us'}],
      ['us']
    );
    expect(none).toHaveLength(0);
  });

  it('limits to only parameter', () => {
    ConfigStore.set('localities', [
      {name: 'us', url: 'https://us.sentry.io'},
      {name: 'de', url: 'https://de.sentry.io'},
      {name: 'ja', url: 'https://ja.sentry.io'},
    ]);

    const res = getLocalityUrlOptions([], ['us']);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      value: 'https://us.sentry.io',
      label: '🇺🇸 United States of America (US)',
    });
  });
});

describe('getLocalityNameOptions', () => {
  let configstate: Config;

  beforeEach(() => {
    configstate = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configstate);
  });
  it('returns options', () => {
    ConfigStore.set('localities', [
      {name: 'us', url: 'https://us.sentry.io'},
      {name: 'us2', url: 'https://us2.sentry.io'},
      {name: 'de', url: 'https://de.sentry.io'},
      {name: 'ja', url: 'https://ja.sentry.io'},
    ]);

    const res = getLocalityNameOptions();
    expect(res).toHaveLength(4);

    expect(res[0]).toEqual({value: 'us', label: '🇺🇸 United States of America (US)'});
    expect(res[1]).toEqual({value: 'us2', label: '🇺🇸 United States of America (US2)'});
    expect(res[2]).toEqual({value: 'de', label: '🇪🇺 European Union (EU)'});
    // No defined label name
    expect(res[3]).toEqual({value: 'ja', label: 'ja'});
  });
});
