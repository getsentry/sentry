import {FormErrorContextProvider, type MappedFormError} from '@sentry/scraps/form';

import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

const sentryFormErrorMapper = <TFormData,>(
  error: Error,
  formValues: TFormData,
  fallbackMessage: string
): MappedFormError<TFormData> | undefined => {
  if (!(error instanceof RequestError)) {
    return undefined;
  }

  const requestFieldErrors = requestErrorToFieldErrors(error, formValues);
  if (Object.keys(requestFieldErrors).length > 0) {
    return {fieldErrors: requestFieldErrors};
  }

  return {message: getRequestErrorUserMessage(error, fallbackMessage)};
};

export function SentryFormErrorProvider({children}: {children: React.ReactNode}) {
  return (
    <FormErrorContextProvider value={sentryFormErrorMapper}>
      {children}
    </FormErrorContextProvider>
  );
}
