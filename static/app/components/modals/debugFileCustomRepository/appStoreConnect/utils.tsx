import * as Sentry from '@sentry/react';

import {t} from 'app/locale';

type ErrorCode =
  | 'app-connect-authentication-error'
  | 'app-connect-multiple-sources-error'
  | 'itunes-authentication-error'
  | 'itunes-2fa-required'
  | 'itunes-sms-blocked-error';

export type DetailedErrorResponse = {
  status: number;
  responseJSON?: {
    detail: {
      code: ErrorCode;
      extra: Record<string, any>;
      message: string;
    };
  };
};

type NotDetailedErrorResponse = {
  status: number;
  responseJSON?: {
    code: string[];
  };
};

type Error = DetailedErrorResponse | NotDetailedErrorResponse;

const unexpectedErrorMessage = t(
  'An unexpected error occurred while configuring the app store connect'
);

export function getAppStoreErrorMessage(error: Error | string) {
  if (typeof error === 'string') {
    return error;
  }

  if ((error as NotDetailedErrorResponse).responseJSON?.code) {
    return (
      (error as NotDetailedErrorResponse).responseJSON?.code[0] ?? unexpectedErrorMessage
    );
  }

  switch ((error as DetailedErrorResponse).responseJSON?.detail.code) {
    case 'app-connect-authentication-error':
      return t(
        'We could not establish a connection with App Store Connect. Please check the entered App Store Connect credentials'
      );
    case 'app-connect-multiple-sources-error':
      return t('Only one Apple App Store Connect application is allowed in this project');
    case 'itunes-authentication-error':
      return t('The iTunes authentication failed. Please check the provided credentials');
    case 'itunes-sms-blocked-error':
      return t(
        'Blocked from requesting more SMS codes for an unspecified period of time'
      );
    case 'itunes-2fa-required':
      return t('The two factor authentication failed. Please check the entered code');
    default: {
      // this shall not happen
      Sentry.captureException(new Error('Unknown app store connect error'));
      return unexpectedErrorMessage;
    }
  }
}
