import type {FieldErrors} from '@sentry/scraps/form';

import type {RequestError} from './requestError';

/** Maps a Sentry API error to the error contract used by Scraps forms. */
export function requestErrorToFieldErrors<TFormValues>(
  error: RequestError,
  formValues: TFormValues
): FieldErrors<TFormValues> {
  const fieldErrors: Record<string, {message: string}> = {};

  if (typeof formValues === 'object' && formValues !== null) {
    for (const [key, value] of Object.entries(error.responseJSON ?? {})) {
      if (!(key in formValues)) {
        continue;
      }
      if (typeof value === 'string') {
        fieldErrors[key] = {message: value};
      } else if (Array.isArray(value) && value.length > 0) {
        fieldErrors[key] = {
          message: typeof value[0] === 'string' ? value[0] : String(value[0]),
        };
      }
    }
  }

  return fieldErrors;
}
