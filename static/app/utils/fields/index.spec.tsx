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

  it('uses ATTRIBUTE_SEARCH_METADATA briefs and converted types', () => {
    const definition = getFieldDefinition(FieldKey.DEVICE_BATTERY_LEVEL);

    expect(definition?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA[FieldKey.DEVICE_BATTERY_LEVEL]?.brief
    );
    expect(definition?.valueType).toBe(FieldValueType.NUMBER);
  });

  it('keeps more specific local unit types when conventions only expose double', () => {
    const definition = getFieldDefinition(SpanFields.GEN_AI_COST_TOTAL_TOKENS, 'span');

    expect(definition?.valueType).toBe(FieldValueType.CURRENCY);
    expect(definition?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA[SpanFields.GEN_AI_COST_TOTAL_TOKENS]?.brief
    );
  });

  it('keeps local DATE valueType because conventions have no date variant', () => {
    expect(getFieldDefinition(FieldKey.TIMESTAMP)?.valueType).toBe(FieldValueType.DATE);
    expect(getFieldDefinition(FieldKey.RELEASE_CREATED)?.valueType).toBe(
      FieldValueType.DATE
    );
  });

  it('falls back to ATTRIBUTE_SEARCH_METADATA for unmapped explore attributes', () => {
    const definition = getFieldDefinition('http.route', 'span');

    expect(definition).toEqual({
      kind: FieldKind.FIELD,
      desc: ATTRIBUTE_SEARCH_METADATA['http.route']?.brief,
      valueType: FieldValueType.STRING,
    });
  });

  it('marks array-typed convention attributes as arrays', () => {
    const definition = getFieldDefinition('sentry.sdk.integrations', 'span');

    expect(definition?.kind).toBe(FieldKind.ARRAY);
    expect(definition?.valueType).toBe(FieldValueType.ARRAY);
    expect(definition?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA['sentry.sdk.integrations']?.brief
    );
  });

  it('does not put explore-only convention attributes on event search', () => {
    expect(getFieldDefinition('http.route')).toBeNull();
    expect(getFieldDefinition('http.route', 'span')).not.toBeNull();
  });

  it('picks convention-backed FieldKeys and span fields onto event search', () => {
    expect(getFieldDefinition(FieldKey.BROWSER_NAME)?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA[FieldKey.BROWSER_NAME]?.brief
    );
    expect(getFieldDefinition(SpanFields.SPAN_OP)?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA[SpanFields.SPAN_OP]?.brief
    );
  });

  it('exposes deprecation chain values as keywords', () => {
    const definition = getFieldDefinition('gen_ai.usage.output_tokens', 'span');

    expect(definition?.keywords).toEqual(
      expect.arrayContaining([
        'ai.completion_tokens.used',
        'gen_ai.usage.completion_tokens',
      ])
    );
    expect(definition?.deprecated).toBeUndefined();
  });

  it('marks replaced search names as deprecated', () => {
    const definition = getFieldDefinition('ai.completion_tokens.used', 'span');

    expect(definition?.deprecated).toBe(true);
    expect(getFieldDefinition('environment', 'span')?.deprecated).toBeUndefined();
  });
});
