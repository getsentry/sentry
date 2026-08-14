import {comparePlatformNames} from 'sentry/utils/platform';

import {platformOptions} from './scmPlatformHelpers';

describe('platformOptions', () => {
  it('sorts platforms like the legacy picker All tab', () => {
    const names = platformOptions.map(option => option.label);

    expect(names).toEqual(names.toSorted(comparePlatformNames));

    // Names starting with punctuation (the .NET family) sort last, not first.
    const firstPunctuationIndex = names.findIndex(name => name.startsWith('.'));
    expect(firstPunctuationIndex).toBeGreaterThan(0);
    expect(names.slice(firstPunctuationIndex).every(name => name.startsWith('.'))).toBe(
      true
    );
  });
});
