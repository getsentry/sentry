import * as Sentry from '@sentry/react';

import {t} from 'app/locale';

import {StepOneData} from './types';

// since translations are done on the front-end we need to map  back-end error messages to front-end messages
const fieldErrorMessageMapping = {
  appconnectIssuer: {
    issuer: {
      'Ensure this field has at least 36 characters.': t(
        'This field should be exactly 36 characters.'
      ),
      'Ensure this field has no more than 36 characters.': t(
        'This field should be exactly 36 characters.'
      ),
    },
  },
  appconnectKey: {
    keyId: {
      'Ensure this field has at least 2 characters.': t(
        'This field should be between 2 and 20 characters.'
      ),
      'Ensure this field has no more than 20 characters.': t(
        'This field should be between 2 and 20 characters.'
      ),
    },
  },
};

export type ErrorCodeDetailed =
  | 'app-connect-authentication-error'
  | 'app-connect-forbidden-error'
  | 'app-connect-multiple-sources-error';

export type ValidationErrorDetailed = {
  code: ErrorCodeDetailed;
};

type ResponseJSONDetailed = {
  detail: ValidationErrorDetailed & {
    extra: Record<string, any>;
    message: string;
  };
};

export type AppStoreConnectField = keyof typeof fieldErrorMessageMapping;

type ResponseJSON = Record<AppStoreConnectField, string[]>;

type Error = {
  status: number;
  responseJSON?: ResponseJSON | ResponseJSONDetailed;
};

export const unexpectedErrorMessage = t(
  'An unexpected error occurred while configuring the App Store Connect integration'
);

export function getAppStoreErrorMessage(
  error: Error | string
): string | Record<keyof StepOneData, string> {
  if (typeof error === 'string') {
    return error;
  }

  const detailedErrorResponse = (error.responseJSON as undefined | ResponseJSONDetailed)
    ?.detail;

  if (detailedErrorResponse) {
    return getAppStoreValidationErrorMessage(detailedErrorResponse);
  }

  const errorResponse = error.responseJSON as undefined | ResponseJSON;

  if (!errorResponse) {
    return unexpectedErrorMessage;
  }

  return (Object.keys(errorResponse) as AppStoreConnectField[]).reduce(
    (acc, serverSideField) => {
      const fieldErrorMessage = fieldErrorMessageMapping[serverSideField] ?? {};
      const field = Object.keys(fieldErrorMessage)[0];

      const errorMessages: string[] = errorResponse[serverSideField].map(errorMessage => {
        if (fieldErrorMessage[field][errorMessage]) {
          return fieldErrorMessage[field][errorMessage];
        }

        // This will be difficult to happen,
        // but if it happens we will be able to see which message is not being mapped on the fron-tend
        Sentry.withScope(scope => {
          scope.setExtra('serverSideField', serverSideField);
          scope.setExtra('message', errorMessage);
          Sentry.captureException(
            new Error('App Store Connect - Untranslated error message')
          );
        });

        return errorMessage;
      });

      // the UI only displays one error message at a time
      return {...acc, [field]: errorMessages[0]};
    },
    {}
  ) as Record<keyof StepOneData, string>;
}

export function getAppStoreValidationErrorMessage(
  error: ValidationErrorDetailed
): string {
  switch (error.code) {
    case 'app-connect-authentication-error':
      return t(
        'Credentials are invalid, missing, or expired. Check the entered App Store Connect credentials are correct and have not expired.'
      );
    case 'app-connect-forbidden-error':
      return t('The supplied API key does not have sufficient permissions.');
    case 'app-connect-multiple-sources-error':
      return t('Only one Apple App Store Connect application is allowed in this project');
    default: {
      // this shall not happen
      Sentry.captureException(new Error('Unknown app store connect error'));
      return unexpectedErrorMessage;
    }
  }
}
