import {platforms} from 'sentry/data/platforms';

import {platformOptions} from './scmPlatformHelpers';

describe('platformOptions', () => {
  it('sorts platforms alphabetically by display name', () => {
    const names = platformOptions.map(option => option.label);

    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b)));
  });

  it('keeps every platform exactly once', () => {
    const values = platformOptions.map(option => option.value);

    expect(new Set(values).size).toBe(values.length);
    expect(values).toHaveLength(platforms.length);
  });
});
