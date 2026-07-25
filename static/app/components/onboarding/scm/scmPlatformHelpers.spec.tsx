import {platforms} from 'sentry/data/platforms';

import {toSelectedSdk} from './scmPlatformHelpers';

describe('toSelectedSdk', () => {
  it('preserves an aliased platform identity while using its SDK key', () => {
    const expo = platforms.find(platform => platform.id === 'expo');

    expect(expo).toBeDefined();
    expect(toSelectedSdk(expo!)).toEqual(
      expect.objectContaining({
        key: 'react-native',
        platformId: 'expo',
      })
    );
  });
});
