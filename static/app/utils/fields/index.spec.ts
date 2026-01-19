import {ATTRIBUTE_METADATA} from '@sentry/conventions';

import {
  FieldKind,
  FieldValueType,
  getConventionsFallbackFieldDefinition,
  getFieldDefinition,
} from 'sentry/utils/fields';

const findConventionsOnlyKey = () => {
  // Find a key that exists in ATTRIBUTE_METADATA but doesn't have a field definition
  // in the standard field definitions for logs
  const keys = Object.keys(ATTRIBUTE_METADATA);
  return keys.find(key => {
    const fallback = getConventionsFallbackFieldDefinition(key, FieldKind.TAG);
    return fallback !== null;
  });
};

describe('getConventionsFallbackFieldDefinition', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/attribute-mappings/',
      body: {data: []},
    });
  });

  it('returns null for unknown keys', () => {
    expect(getConventionsFallbackFieldDefinition('__unknown__')).toBeNull();
  });

  it('returns fallback definitions from metadata', () => {
    const sampleKey = Object.keys(ATTRIBUTE_METADATA)[0];
    expect(sampleKey).toBeDefined();
    if (!sampleKey) {
      return;
    }

    const fallback = getConventionsFallbackFieldDefinition(sampleKey, FieldKind.TAG);
    expect(fallback).toMatchObject({
      kind: FieldKind.TAG,
      valueType: FieldValueType.STRING,
    });

    const tagFallback = getConventionsFallbackFieldDefinition(
      `tags[${sampleKey}]`,
      FieldKind.TAG
    );
    expect(tagFallback).toMatchObject({
      kind: FieldKind.TAG,
      valueType: FieldValueType.STRING,
    });
  });

  it('maps kind to expected fallback value type', () => {
    const sampleKey = Object.keys(ATTRIBUTE_METADATA)[0];
    expect(sampleKey).toBeDefined();
    if (!sampleKey) {
      return;
    }

    expect(
      getConventionsFallbackFieldDefinition(sampleKey, FieldKind.MEASUREMENT)
    ).toMatchObject({
      kind: FieldKind.MEASUREMENT,
      valueType: FieldValueType.NUMBER,
    });

    expect(
      getConventionsFallbackFieldDefinition(sampleKey, FieldKind.BOOLEAN)
    ).toMatchObject({
      kind: FieldKind.BOOLEAN,
      valueType: FieldValueType.BOOLEAN,
    });
  });
});

describe('getFieldDefinition', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/attribute-mappings/',
      body: {data: []},
    });
  });

  it('falls back to conventions when no mappings are provided', () => {
    const conventionsOnlyKey = findConventionsOnlyKey();
    expect(conventionsOnlyKey).toBeDefined();
    if (!conventionsOnlyKey) {
      return;
    }

    const fallback = getConventionsFallbackFieldDefinition(
      conventionsOnlyKey,
      FieldKind.TAG
    );

    const definition = getFieldDefinition(conventionsOnlyKey, 'log', FieldKind.TAG);
    expect(definition).toMatchObject(fallback ?? {});
  });

  it('skips conventions fallback for internally mapped keys', () => {
    const conventionsOnlyKey = findConventionsOnlyKey();
    expect(conventionsOnlyKey).toBeDefined();
    if (!conventionsOnlyKey) {
      return;
    }

    // First verify it would normally return a fallback
    const fallback = getConventionsFallbackFieldDefinition(
      conventionsOnlyKey,
      FieldKind.TAG
    );
    expect(fallback).not.toBeNull();

    // Now test with a mapping where internalName === key and publicAlias !== internalName
    // This should skip conventions fallback
    const definition = getFieldDefinition(conventionsOnlyKey, 'log', {
      kind: FieldKind.TAG,
      mappings: [
        {
          internalName: conventionsOnlyKey,
          publicAlias: `public.${conventionsOnlyKey}`,
          searchType: 'string',
          type: 'log',
        },
      ],
    });

    expect(definition).toStrictEqual({
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
    });
  });
});
