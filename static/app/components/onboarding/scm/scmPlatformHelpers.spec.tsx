import {categoryList} from 'sentry/data/platformPickerCategories';

import {platformOptionGroups, platformOptions} from './scmPlatformHelpers';

describe('platformOptionGroups', () => {
  it('uses the platform picker category order', () => {
    expect(platformOptionGroups.map(group => group.label)).toEqual([
      ...categoryList
        .filter(category => category.id !== 'all')
        .map(category => category.name),
      'Other',
    ]);
  });

  it('keeps curated Popular-tab order and sorts other sections alphabetically', () => {
    const [popularGroup, ...otherGroups] = platformOptionGroups;
    const popularCategory = categoryList.find(category => category.id === 'popular');

    expect(popularGroup?.options.map(option => option.value)).toEqual(
      Array.from(popularCategory?.platforms ?? [])
    );

    for (const group of otherGroups) {
      const names = group.options.map(option => option.label);
      expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b)));
    }
  });

  it('puts every platform in exactly one section', () => {
    const groupedValues = platformOptionGroups.flatMap(group =>
      group.options.map(option => option.value)
    );
    const optionValues = platformOptions.map(option => option.value);

    expect(groupedValues).toHaveLength(optionValues.length);
    expect(new Set(groupedValues)).toEqual(new Set(optionValues));
  });
});
