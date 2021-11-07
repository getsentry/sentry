import * as Sentry from '@sentry/react';

import {t} from 'app/locale';

type ValidationErrorDetailed = {
  code:
    | 'app-connect-authentication-error'
    | 'app-connect-forbidden-error'
    | 'app-connect-multiple-sources-error';
};

export const unexpectedErrorMessage = t(
  'An unexpected error occurred while configuring the App Store Connect integration'
);

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
