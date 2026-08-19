import {FieldKind} from 'sentry/utils/fields';
import {
  collapseDuplicateFilterKeyNames,
  collapseDuplicateFilterKeys,
  getHasTag,
  isRedundantExplicitFilterKey,
} from 'sentry/utils/tag';

describe('collapseDuplicateFilterKeyNames', () => {
  it('prefers bare keys over explicit tag twins', () => {
    expect(
      collapseDuplicateFilterKeyNames([
        'tags[user.email,string]',
        'user.email',
        'tags[foo,string]',
        'tags[foo,number]',
      ])
    ).toEqual(['user.email', 'tags[foo,string]', 'tags[foo,number]']);
  });
});

describe('collapseDuplicateFilterKeys', () => {
  it('keeps the bare tag object when an explicit twin exists', () => {
    const bare = {key: 'user.email', name: 'user.email', kind: FieldKind.TAG};
    const explicit = {
      key: 'tags[user.email,string]',
      name: 'user.email',
      kind: FieldKind.TAG,
    };

    expect(collapseDuplicateFilterKeys([explicit, bare])).toEqual([bare]);
  });
});

describe('isRedundantExplicitFilterKey', () => {
  it('marks explicit keys redundant when a bare key already exists', () => {
    const existing = new Set(['user.email']);
    expect(isRedundantExplicitFilterKey('tags[user.email,string]', existing)).toBe(true);
    expect(isRedundantExplicitFilterKey('user.email', existing)).toBe(true);
    expect(isRedundantExplicitFilterKey('novel.tag', existing)).toBe(false);
  });
});

describe('getHasTag', () => {
  it('deduplicates bare and explicit twins in has values', () => {
    const hasTag = getHasTag({
      'user.email': {key: 'user.email', name: 'user.email', kind: FieldKind.TAG},
      'tags[user.email,string]': {
        key: 'tags[user.email,string]',
        name: 'user.email',
        kind: FieldKind.TAG,
      },
      'tags[foo,string]': {
        key: 'tags[foo,string]',
        name: 'foo',
        kind: FieldKind.TAG,
      },
      'tags[foo,number]': {
        key: 'tags[foo,number]',
        name: 'foo',
        kind: FieldKind.MEASUREMENT,
      },
    });

    expect(hasTag.values).toEqual(['tags[foo,number]', 'tags[foo,string]', 'user.email']);
  });
});
