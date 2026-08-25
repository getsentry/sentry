import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions';

import {
  ATTRIBUTE_SEARCH_SECONDARY_ALIASES,
  getAttributeSearchDeprecationAliases,
  getPreferredAttributeSearchKey,
} from './getAttributeSearchSecondaryAliases';
import {FieldKind} from './types';

describe('getAttributeSearchDeprecationAliases', () => {
  it('returns chain members other than the search key', () => {
    expect(getAttributeSearchDeprecationAliases('gen_ai.usage.output_tokens')).toEqual(
      ATTRIBUTE_SEARCH_METADATA['gen_ai.usage.output_tokens']?.deprecationChain.filter(
        alias => alias !== 'gen_ai.usage.output_tokens'
      )
    );
  });

  it('drops template keys', () => {
    expect(getAttributeSearchDeprecationAliases('params.<key>')).not.toContain(
      'url.path.parameter.<key>'
    );
  });
});

describe('ATTRIBUTE_SEARCH_SECONDARY_ALIASES', () => {
  it('maps deprecated names onto alias tags', () => {
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['ai.completion_tokens.used']).toEqual({
      key: 'ai.completion_tokens.used',
      name: 'ai.completion_tokens.used',
      alias: 'gen_ai.usage.output_tokens',
      kind: FieldKind.MEASUREMENT,
    });
  });

  it('does not alias preferred search keys to themselves', () => {
    expect(
      ATTRIBUTE_SEARCH_SECONDARY_ALIASES['gen_ai.usage.output_tokens']
    ).toBeUndefined();
  });

  it('points internal names at the search-facing key', () => {
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['sentry.environment']?.alias).toBe(
      'environment'
    );
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES.environment).toBeUndefined();
  });

  it('uses getPreferredAttributeSearchKey when a name appears in multiple chains', () => {
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['django.function_name']?.alias).toBe(
      'code.function.name'
    );
    expect(getPreferredAttributeSearchKey('django.function_name')).toBe(
      'code.function.name'
    );
  });

  it('points metadata aliases at getPreferredAttributeSearchKey, not the first claimant', () => {
    for (const [key, tag] of Object.entries(ATTRIBUTE_SEARCH_SECONDARY_ALIASES)) {
      const preferred = getPreferredAttributeSearchKey(key);
      if (preferred) {
        expect(tag.alias).toBe(preferred);
      }
    }
  });

  it('does not point aliases at template keys', () => {
    for (const tag of Object.values(ATTRIBUTE_SEARCH_SECONDARY_ALIASES)) {
      expect(tag.alias).not.toContain('<');
    }
  });
});
