import {getSubmitButtonTitle as getSubmitButtonTitleBase} from 'sentry/components/forms/form';
import type FormModel from 'sentry/components/forms/model';

/**
 * Wraps the base getSubmitButtonTitle to support an optional disabledReason
 * that takes precedence over form-state-derived titles.
 */
export function getSubmitButtonTitle(
  form: FormModel,
  disabledReason?: string
): string | undefined {
  if (disabledReason) {
    return disabledReason;
  }

  return getSubmitButtonTitleBase(form);
}
