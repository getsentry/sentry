import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import {TraceItemDataset} from 'sentry/views/explore/types';

import {sortSearchedAttributes} from './sortSearchedAttributes';

function option(key: string, label: string): SelectOptionWithKey<string> {
  return {key, value: key, label, textValue: key};
}

function score(key: string, label: string, searchText: string) {
  return sortSearchedAttributes({
    fieldDefinitionType: TraceItemDataset.LOGS,
    option: option(key, label),
    searchText,
  }).score;
}

describe('sortSearchedAttributes', () => {
  it('ranks an exact typed-key match with its untyped twin', () => {
    const untyped = score('organization_id', 'organization_id', 'organization_id');
    const typed = score(
      'tags[organization_id,number]',
      'organization_id',
      'organization_id'
    );
    const suffixMatch = score(
      'tags[current_organization_id,number]',
      'current_organization_id',
      'organization_id'
    );

    expect(typed).toBe(untyped);
    expect(typed).toBeGreaterThan(suffixMatch);
  });

  it('still matches searches for the typed key syntax', () => {
    expect(
      score('tags[organization_id,number]', 'organization_id', 'tags[organization')
    ).toBeGreaterThan(0);
  });

  it('does not match options that do not contain the search text', () => {
    expect(score('tags[organization_id,number]', 'organization_id', 'project')).toBe(0);
  });
});
