import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions';

import {
  ATTRIBUTE_SEARCH_SECONDARY_ALIASES,
  getAttributeSearchDeprecationAliases,
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
});
