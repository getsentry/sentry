import type {FormModel} from 'sentry/components/forms/model';
import type {FieldValue} from 'sentry/components/forms/types';

/**
 * The form values returned by form.getValue are not typed, so this is a
 * convenient helper to do a type assertion while getting the value.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function getFormFieldValue<T extends FieldValue = FieldValue>(
  form: FormModel,
  field: string
): T {
  return form.getValue(field);
}
