import type FormModel from 'sentry/components/forms/model';
import {t} from 'sentry/locale';

export function getSubmitButtonTitle(
  form: FormModel,
  disabledReason?: string
): string | undefined {
  if (disabledReason) {
    return disabledReason;
  }

  if (form.isFormIncomplete) {
    return t('Required fields must be filled out');
  }

  if (form.isError) {
    return t('Form contains errors');
  }

  return undefined;
}
