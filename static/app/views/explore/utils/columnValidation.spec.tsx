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

  it('excludes _if filter queries from fields sent for validation', () => {
    expect(
      getColumnFieldsForValidation({
        aggregateFields: [
          new VisualizeFunction('avg_if(`span.op:db`,span.duration)'),
          new VisualizeFunction('failure_rate_if(`span.status:error`)'),
        ],
        fields: ['id'],
      })
    ).toEqual([
      'id',
      'avg_if(`span.op:db`,span.duration)',
      'span.duration',
      'failure_rate_if(`span.status:error`)',
    ]);
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

  it('preserves _if aggregates when only the filter query would be invalid as a field', () => {
    const filterQuery = '`span.op:db`';
    const yAxis = `avg_if(${filterQuery},span.duration)`;
    const validationData: EventValidationData = {
      dataset: [],
      environment: [],
      field: [
        {attrType: 'number', error: null, name: yAxis, valid: true},
        {attrType: 'number', error: null, name: 'span.duration', valid: true},
        // If the filter were sent as a field, it would be invalid — ensure we
        // still keep the visualize even if it somehow appears in invalidFields.
        {attrType: null, error: 'unknown field', name: filterQuery, valid: false},
      ],
      orderby: [],
      projects: [],
      query: {error: null, fields: [], valid: true},
      valid: false,
    };

    const result = getValidatedColumnData({
      aggregateFields: [new VisualizeFunction(yAxis)],
      attributes: {boolean: {}, number: {}, string: {}},
      fields: ['id'],
      validationData,
    });

    expect(
      result.aggregateFields.map(aggregateField =>
        'groupBy' in aggregateField ? aggregateField.groupBy : aggregateField.yAxis
      )
    ).toEqual([yAxis]);
  });
});
