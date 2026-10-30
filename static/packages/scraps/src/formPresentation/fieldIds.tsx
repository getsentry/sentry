import type {FieldWithValue} from './formHelpers';

export const getFieldId = (field: FieldWithValue<unknown>) =>
  field.form.formId + field.name;

export const getHintTextId = (field: FieldWithValue<unknown>) =>
  `${getFieldId(field)}-hint`;

export const getLabelId = (field: FieldWithValue<unknown>) =>
  `${getFieldId(field)}-label`;
