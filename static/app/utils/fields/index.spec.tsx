import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions/attributes/search';

import {
  FieldKind,
  FieldKey,
  FieldValueType,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {SpanFields} from 'sentry/views/insights/types';

describe('getFieldDefinition attribute search metadata', () => {
  it.each(['constructor', 'toString', '__proto__'])(
    'treats %s as a custom attribute rather than convention metadata',
    key => {
      expect(getFieldDefinition(key, 'span')).toBeNull();
      expect(getFieldDefinition(key, 'span', FieldKind.TAG)).toEqual({
        kind: FieldKind.FIELD,
        valueType: FieldValueType.STRING,
      });
    }
  );

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
    const eventDefinition = getFieldDefinition(FieldKey.TYPE);
    const spanDefinition = getFieldDefinition(FieldKey.TYPE, 'span');

    expect(eventDefinition?.desc).toBe(
      'Type of event (Errors, transactions, csp and default)'
    );
    expect(spanDefinition?.desc).toBe(ATTRIBUTE_SEARCH_METADATA[FieldKey.TYPE]?.brief);
    expect(getFieldDefinition(FieldKey.TYPE)).toBe(eventDefinition);
    expect(getFieldDefinition(FieldKey.TYPE, 'span')).toBe(spanDefinition);
  });

  it.each([
    [FieldKey.ID, 'The event identification number'],
    [FieldKey.TRANSACTION, 'Error or transaction name identifier'],
    [FieldKey.HTTP_URL, 'Full URL of the request without parameters'],
  ])('keeps the event-specific description for %s', (key, description) => {
    expect(getFieldDefinition(key)?.desc).toBe(description);
    expect(getFieldDefinition(key, 'span')?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA[key]?.brief
    );
  });

  it('keeps the local tracemetric description for id', () => {
    expect(getFieldDefinition(TraceMetricKnownFieldKey.ID, 'tracemetric')?.desc).toBe(
      'The unique identifier.'
    );
    expect(getFieldDefinition(TraceMetricKnownFieldKey.ID, 'span')?.desc).toBe(
      ATTRIBUTE_SEARCH_METADATA[TraceMetricKnownFieldKey.ID]?.brief
    );
  });

  it('keeps custom field kinds independent across repeated lookups', () => {
    expect(getFieldDefinition('checkout.cart_size', 'span')).toBeNull();
    expect(
      getFieldDefinition('checkout.cart_size', 'span', FieldKind.MEASUREMENT)?.valueType
    ).toBe(FieldValueType.NUMBER);
    expect(
      getFieldDefinition('checkout.cart_size', 'span', FieldKind.TAG)?.valueType
    ).toBe(FieldValueType.STRING);
    expect(getFieldDefinition('checkout.cart_size', 'span')).toBeNull();
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
      keywords: ['route'],
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
