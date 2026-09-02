import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions';

import {
  FieldKind,
  FieldKey,
  FieldValueType,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {SpanFields} from 'sentry/views/insights/types';

describe('getFieldDefinition attribute search metadata', () => {
  it.each([
    ['replay', 'A url visited within the replay'],
    ['feedback', 'URL of the page that the feedback is triggered on'],
  ] as const)(
    'keeps the product-specific description for %s url',
    (type, description) => {
      const definition = getFieldDefinition('url', type);

      expect(definition?.desc).toBe(description);
      expect(definition?.deprecated).toBe(false);
    }
  );

  it('keeps the issue-specific description for type', () => {
    expect(getFieldDefinition(FieldKey.TYPE)?.desc).toBe(
      'Type of event (Errors, transactions, csp and default)'
    );
    expect(getFieldDefinition(FieldKey.TYPE, 'span')?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA[FieldKey.TYPE]?.brief
    );
  });

  it('sources event and explore field definitions from conventions', () => {
    expect(getFieldDefinition(FieldKey.DEVICE_BATTERY_LEVEL)).toMatchObject({
      desc: ATTRIBUTE_SEARCH_METADATA[FieldKey.DEVICE_BATTERY_LEVEL]?.brief,
      valueType: FieldValueType.NUMBER,
    });
    expect(getFieldDefinition('http.route')).toBeNull();
    expect(getFieldDefinition('http.route', 'span')).toEqual({
      kind: FieldKind.FIELD,
      desc: ATTRIBUTE_SEARCH_METADATA['http.route']?.brief,
      valueType: FieldValueType.STRING,
    });
  });

  it('keeps more specific local value types', () => {
    expect(
      getFieldDefinition(SpanFields.GEN_AI_COST_TOTAL_TOKENS, 'span')?.valueType
    ).toBe(FieldValueType.CURRENCY);
    expect(getFieldDefinition(FieldKey.TIMESTAMP)?.valueType).toBe(FieldValueType.DATE);
  });

  it('marks array-typed convention attributes as arrays', () => {
    expect(getFieldDefinition('sentry.sdk.integrations', 'span')).toMatchObject({
      kind: FieldKind.ARRAY,
      valueType: FieldValueType.ARRAY,
    });
  });

  it('maps deprecation chains onto preferred field definitions', () => {
    const preferred = getFieldDefinition('gen_ai.usage.output_tokens', 'span');

    expect(preferred?.keywords).toEqual(
      expect.arrayContaining([
        'ai.completion_tokens.used',
        'gen_ai.usage.completion_tokens',
      ])
    );
    expect(preferred?.deprecated).toBeUndefined();
    expect(getFieldDefinition('ai.completion_tokens.used', 'span')?.deprecated).toBe(
      true
    );
  });
});
