import {popularPlatformCategories} from 'sentry/data/platformPickerCategories';
import {platforms} from 'sentry/data/platforms';
import {comparePlatformNames} from 'sentry/utils/platform';

import {platformOptionGroups, platformOptions} from './scmPlatformHelpers';

describe('platformOptionGroups', () => {
  const [popularGroup, otherGroup] = platformOptionGroups;

  it('leads with the curated popular section in Popular-tab order', () => {
    expect(popularGroup!.label).toBe('Popular');
    expect(popularGroup!.options.map(option => option.value)).toEqual(
      Array.from(popularPlatformCategories)
    );
  });

  it('sorts the Other section alphabetically with punctuation-prefixed names last', () => {
    expect(otherGroup!.label).toBe('Other platforms');
    const names = otherGroup!.options.map(option => option.label);
    expect(names).toEqual(names.toSorted(comparePlatformNames));

    // Names starting with punctuation (the .NET family) sort last, not first.
    const firstPunctuationIndex = names.findIndex(name => name.startsWith('.'));
    expect(firstPunctuationIndex).toBeGreaterThan(0);
    expect(names.slice(firstPunctuationIndex).every(name => name.startsWith('.'))).toBe(
      true
    );
  });

  it('keeps every platform exactly once across sections', () => {
    const values = platformOptions.map(option => option.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toHaveLength(platforms.length);
  });
});
