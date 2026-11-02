import {getAttributeSearchMetadata} from './getAttributeSearchMetadata';
import {
  ATTRIBUTE_SEARCH_SECONDARY_ALIASES,
  getAttributeSearchDeprecationAliases,
  getPreferredAttributeSearchKey,
} from './getAttributeSearchSecondaryAliases';
import {FieldKind} from './types';

describe('ATTRIBUTE_SEARCH_SECONDARY_ALIASES', () => {
  it.each(['constructor', 'toString', '__proto__'])(
    'does not treat inherited key %s as attribute search metadata',
    key => {
      expect(getPreferredAttributeSearchKey(key)).toBeUndefined();
      expect(getAttributeSearchMetadata(key)).toBeUndefined();
      expect(getAttributeSearchDeprecationAliases(key)).toEqual([]);
    }
  );

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
    expect(getPreferredAttributeSearchKey('net.peer.name')).toBe('server.address');
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['net.peer.name']?.alias).toBe(
      'server.address'
    );
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['sentry.release']?.alias).toBe('release');
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['sentry.environment']?.alias).toBe(
      'environment'
    );
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['django.function_name']?.alias).toBe(
      'code.function.name'
    );
  });

  it('preserves alias types when they differ from their replacements', () => {
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES['ai.texts']?.kind).toBe(FieldKind.ARRAY);
    expect(ATTRIBUTE_SEARCH_SECONDARY_ALIASES.deviceMemory?.kind).toBe(FieldKind.TAG);
  });

  it('excludes template keys', () => {
    expect(getAttributeSearchDeprecationAliases('params.<key>')).not.toContain(
      'url.path.parameter.<key>'
    );
    for (const tag of Object.values(ATTRIBUTE_SEARCH_SECONDARY_ALIASES)) {
      expect(tag.alias).not.toContain('<');
    }
  });

  it('can include template aliases for visibility checks', () => {
    const aliases = getAttributeSearchDeprecationAliases('params.<key>', {
      includeTemplateKeys: true,
    });

    expect(aliases).toContain('url.path.parameter.<key>');
    expect(aliases).not.toContain('params.<key>');
  });
});
