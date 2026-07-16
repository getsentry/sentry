import {LocationFixture} from 'sentry-fixture/locationFixture';

import {EventView} from 'sentry/utils/discover/eventView';
import {FieldValueType} from 'sentry/utils/fields';
import {addValidatedFieldTypesToMeta} from 'sentry/views/explore/tables/spansTable';

describe('addValidatedFieldTypesToMeta', () => {
  it('preserves table meta field types over validated field types', () => {
    const meta = addValidatedFieldTypesToMeta({
      meta: {
        fields: {
          'custom.duration': FieldValueType.STRING,
          id: FieldValueType.STRING,
        },
      },
      validatedFieldTypes: {
        'custom.duration': FieldValueType.NUMBER,
        'span.op': FieldValueType.STRING,
      },
    });

    expect(meta.fields).toEqual({
      'custom.duration': FieldValueType.STRING,
      id: FieldValueType.STRING,
      'span.op': FieldValueType.STRING,
    });
  });

  it('uses span field definitions over validated field types', () => {
    const meta = addValidatedFieldTypesToMeta({
      meta: {fields: {'span.duration': FieldValueType.NUMBER}},
      validatedFieldTypes: {'span.duration': FieldValueType.NUMBER},
    });

    expect(meta.fields?.['span.duration']).toBe(FieldValueType.DURATION);
  });

  it('passes validated field types to table column metadata', () => {
    const eventView = EventView.fromLocation(
      LocationFixture({query: {field: ['sentry.duration']}})
    );
    const meta = addValidatedFieldTypesToMeta({
      meta: {fields: {}},
      validatedFieldTypes: {'sentry.duration': FieldValueType.NUMBER},
    });

    expect(eventView.getColumns(meta)[0]?.type).toBe(FieldValueType.NUMBER);
  });
});
