import type {AnyFieldApi} from '@sentry/scraps/form/formHelpers';

export const getFieldId = (field: AnyFieldApi) => field.form.formId + field.name;

export const getHintTextId = (field: AnyFieldApi) => `${getFieldId(field)}-hint`;

export const getLabelId = (field: AnyFieldApi) => `${getFieldId(field)}-label`;
