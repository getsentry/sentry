import {popularPlatformCategories} from 'sentry/data/platformPickerCategories';

import {platformOptions} from './scmPlatformHelpers';

describe('platformOptions', () => {
  const popularOrder = Array.from(popularPlatformCategories);
  const optionValues = platformOptions.map(option => option.value);

  it('puts curated popular platforms first in Popular-tab order', () => {
    expect(optionValues.slice(0, popularOrder.length)).toEqual(popularOrder);
  });

  it('sorts remaining platforms alphabetically by display name', () => {
    const remaining = platformOptions.slice(popularOrder.length);
    const remainingNames = remaining.map(option => option.label);
    const sortedNames = remainingNames.toSorted((a, b) => a.localeCompare(b));

    expect(remainingNames).toEqual(sortedNames);
  });

  it('keeps every platform exactly once', () => {
    expect(new Set(optionValues).size).toBe(optionValues.length);
  });
});
