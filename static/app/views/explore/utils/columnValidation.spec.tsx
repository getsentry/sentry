import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {
  getColumnFieldsForValidation,
  getValidatedColumnData,
} from 'sentry/views/explore/utils/columnValidation';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

describe('getColumnFieldsForValidation', () => {
  it('includes sample fields and aggregate field arguments once', () => {
    expect(
      getColumnFieldsForValidation({
        aggregateFields: [
          {groupBy: 'span.op'},
          {groupBy: ''},
          new VisualizeFunction('avg(sentry.duration)'),
          new VisualizeFunction('count()'),
        ],
        fields: ['id', 'span.op'],
      })
    ).toEqual(['id', 'span.op', 'avg(sentry.duration)', 'sentry.duration', 'count()']);
  });
});

describe('getValidatedColumnData', () => {
  it('adds typed attributes and removes invalid sample and aggregate fields', () => {
    const validationData: EventValidationData = {
      dataset: [],
      environment: [],
      field: [
        {attrType: 'boolean', error: null, name: 'custom.enabled', valid: true},
        {attrType: 'number', error: null, name: 'custom.duration', valid: true},
        {
          attrType: 'number',
          error: null,
          name: 'avg(custom.duration)',
          valid: true,
        },
        {attrType: 'string', error: null, name: 'custom.user', valid: true},
        {attrType: null, error: 'unknown field', name: 'missing.field', valid: false},
      ],
      orderby: [],
      projects: [],
      query: {error: null, fields: [], valid: true},
      valid: false,
    };

    const result = getValidatedColumnData({
      aggregateFields: [
        {groupBy: 'custom.user'},
        {groupBy: 'missing.field'},
        new VisualizeFunction('avg(custom.duration)'),
        new VisualizeFunction('avg(missing.field)'),
      ],
      attributes: {
        boolean: {},
        number: {},
        string: {
          'custom.duration': {
            key: 'custom.duration',
            name: 'custom.duration',
            kind: FieldKind.TAG,
          },
        },
      },
      fields: ['custom.enabled', 'custom.duration', 'missing.field'],
      validationData,
    });

    expect(result.fields).toEqual(['custom.enabled', 'custom.duration']);
    expect(result.fieldTypes).toEqual({
      'avg(custom.duration)': FieldValueType.NUMBER,
      'custom.enabled': FieldValueType.BOOLEAN,
      'custom.duration': FieldValueType.NUMBER,
      'custom.user': FieldValueType.STRING,
    });
    expect(result.attributes.boolean['custom.enabled']?.kind).toBe(FieldKind.BOOLEAN);
    expect(result.attributes.number['custom.duration']?.kind).toBe(FieldKind.MEASUREMENT);
    expect(result.attributes.number['avg(custom.duration)']).toBeUndefined();
    expect(result.attributes.string['custom.duration']).toBeUndefined();
    expect(result.attributes.string['custom.user']?.kind).toBe(FieldKind.TAG);
    expect(
      result.aggregateFields.map(aggregateField =>
        'groupBy' in aggregateField ? aggregateField.groupBy : aggregateField.yAxis
      )
    ).toEqual(['custom.user', 'avg(custom.duration)']);
  });

  it('types array attributes and moves them into the array collection', () => {
    const validationData: EventValidationData = {
      dataset: [],
      environment: [],
      field: [{attrType: 'array', error: null, name: 'custom.tags', valid: true}],
      orderby: [],
      projects: [],
      query: {error: null, fields: [], valid: true},
      valid: true,
    };

    const result = getValidatedColumnData({
      aggregateFields: [],
      // The attribute arrives typed as a string; validation should reclassify it.
      attributes: {
        boolean: {},
        number: {},
        string: {
          'custom.tags': {key: 'custom.tags', name: 'custom.tags', kind: FieldKind.TAG},
        },
        array: {},
      },
      fields: ['custom.tags'],
      validationData,
    });

    // The array column persists through cleanup.
    expect(result.fields).toEqual(['custom.tags']);
    expect(result.fieldTypes).toEqual({'custom.tags': FieldValueType.ARRAY});
    expect(result.attributes.array['custom.tags']?.kind).toBe(FieldKind.ARRAY);
    // ...and is removed from the string collection it was misclassified under.
    expect(result.attributes.string['custom.tags']).toBeUndefined();
  });

  it('keeps known array attributes as arrays even if validation reports a scalar type', () => {
    // Before the backend validate change ships, the endpoint maps array search
    // types to "number". The attributes endpoint still identifies the attribute
    // as an array, so it must win and the column must not be downgraded.
    const validationData: EventValidationData = {
      dataset: [],
      environment: [],
      field: [{attrType: 'number', error: null, name: 'custom.tags', valid: true}],
      orderby: [],
      projects: [],
      query: {error: null, fields: [], valid: true},
      valid: true,
    };

    const result = getValidatedColumnData({
      aggregateFields: [],
      attributes: {
        boolean: {},
        number: {},
        string: {},
        array: {
          'custom.tags': {
            key: 'custom.tags',
            name: 'custom.tags',
            kind: FieldKind.ARRAY,
          },
        },
      },
      fields: ['custom.tags'],
      validationData,
    });

    expect(result.fields).toEqual(['custom.tags']);
    expect(result.fieldTypes).toEqual({'custom.tags': FieldValueType.ARRAY});
    expect(result.attributes.array['custom.tags']?.kind).toBe(FieldKind.ARRAY);
    expect(result.attributes.number['custom.tags']).toBeUndefined();
  });
});
