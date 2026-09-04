import {
  ATTRIBUTE_SEARCH_SECONDARY_ALIASES,
  getAttributeSearchDeprecationAliases,
} from './getAttributeSearchSecondaryAliases';
import {FieldKind} from './types';

describe('ATTRIBUTE_SEARCH_SECONDARY_ALIASES', () => {
  it('maps deprecated names onto preferred search aliases', () => {
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['ai.completion_tokens.used']).toEqual({
      key: 'ai.completion_tokens.used',
      name: 'ai.completion_tokens.used',
      alias: 'gen_ai.usage.output_tokens',
      kind: FieldKind.MEASUREMENT,
    });
    expect(
      ATTRIBUTE_SEARCH_SECONDARY_ALIASES['gen_ai.usage.output_tokens']
    ).toBeUndefined();
  });

  it('resolves internal and overlapping names to search-facing keys', () => {
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['sentry.environment']?.alias).toBe(
      'environment'
    );
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['django.function_name']?.alias).toBe(
      'code.function.name'
    );
  });

  it('excludes template keys', () => {
    expect(getAttributeSearchDeprecationAliases('params.<key>')).not.toContain(
      'url.path.parameter.<key>'
    );
    for (const tag of Object.values(ATTRIBUTE_SEARCH_SECONDARY_ALIASES)) {
      expect(tag.alias).not.toContain('<');
    }
  });
});
