import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {getRegionUrlOptions, getRegionNameOptions} from 'sentry/utils/regions';

describe('getRegionUrlOptions', () => {
  let configstate: Config;

  beforeEach(() => {
    configstate = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configstate);
  });

  it('filters out excluded names', () => {
    ConfigStore.set('regions', [
      {name: 'us', url: 'https://us.sentry.io'},
      {name: 'de', url: 'https://de.sentry.io'},
      {name: 'ja', url: 'https://ja.sentry.io'},
    ]);

    const res = getRegionUrlOptions([
      {name: 'us', url: 'https://us.sentry.io', displayName: 'us', label: 'us'},
    ]);
    expect(res).toHaveLength(2);
    expect(res[0]).toEqual({
      value: 'https://de.sentry.io',
      label: '🇪🇺 European Union (EU)',
    });
    expect(res[1]).toEqual({value: 'https://ja.sentry.io', label: ' ja'});

    // Excluding the only included option = empty set.
    const none = getRegionUrlOptions(
      [{name: 'us', url: 'https://us.sentry.io', displayName: 'us', label: 'us'}],
      ['us']
    );
    expect(none).toHaveLength(0);
  });

  it('limits to only parameter', () => {
    ConfigStore.set('regions', [
      {name: 'us', url: 'https://us.sentry.io'},
      {name: 'de', url: 'https://de.sentry.io'},
      {name: 'ja', url: 'https://ja.sentry.io'},
    ]);

    const res = getRegionUrlOptions([], ['us']);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      value: 'https://us.sentry.io',
      label: '🇺🇸 United States of America (US)',
    });
  });

  it('always excludes US2', () => {
    ConfigStore.set('regions', [
      {name: 'us', url: 'https://us.sentry.io'},
      {name: 'us2', url: 'https://us2.sentry.io'},
      {name: 'de', url: 'https://de.sentry.io'},
      {name: 'ja', url: 'https://ja.sentry.io'},
    ]);

    const res = getRegionUrlOptions();
    expect(res).toHaveLength(3);
    res.forEach(item => expect(item.value).not.toContain('us2'));
  });
});

describe('getRegionNameOptions', () => {
  let configstate: Config;

  beforeEach(() => {
    configstate = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configstate);
  });
  it('always excludes US2', () => {
    ConfigStore.set('regions', [
      {name: 'us', url: 'https://us.sentry.io'},
      {name: 'us2', url: 'https://us2.sentry.io'},
      {name: 'de', url: 'https://de.sentry.io'},
      {name: 'ja', url: 'https://ja.sentry.io'},
    ]);

    const res = getRegionNameOptions();
    expect(res).toHaveLength(3);

    expect(res[0]).toEqual({value: 'us', label: '🇺🇸 United States of America (US)'});

    res.forEach(item => expect(item.label).not.toContain('us2'));
  });
});
