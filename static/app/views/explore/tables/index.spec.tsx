import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {getValidatedColumnEditorData} from 'sentry/views/explore/tables';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

const stringTags: TagCollection = {
  id: {
    key: 'id',
    name: 'id',
    kind: FieldKind.TAG,
  },
  'missing.field': {
    key: 'missing.field',
    name: 'missing.field',
    kind: FieldKind.TAG,
  },
};

const numberTags: TagCollection = {};
const booleanTags: TagCollection = {};

const validatedColumnsData: EventValidationData = {
  dataset: [],
  environment: [],
  field: [
    {attrType: 'number', error: null, name: 'custom.duration', valid: true},
    {attrType: null, error: 'unknown attribute', name: 'missing.field', valid: false},
  ],
  orderby: [],
  projects: [],
  query: {
    error: null,
    fields: [],
    valid: true,
  },
  valid: false,
};

describe('getValidatedColumnEditorData', () => {
  it('adds valid fields and removes invalid fields', () => {
    const result = getValidatedColumnEditorData({
      booleanTags,
      fields: ['id', 'custom.duration', 'missing.field'],
      numberTags,
      stringTags,
      validatedColumnsData,
    });

    expect(result.validatedFields).toEqual(['id', 'custom.duration']);
    expect(result.validatedNumberTags['custom.duration']).toEqual(
      expect.objectContaining({
        key: 'custom.duration',
        kind: FieldKind.MEASUREMENT,
      })
    );
    expect(result.validatedStringTags['missing.field']).toBeUndefined();
  });
});
