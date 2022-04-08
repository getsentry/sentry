import * as Sentry from '@sentry/react';

import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {AppStoreConnectValidationError} from 'sentry/types/debugFiles';

export const unexpectedErrorMessage = t(
  'An unexpected error occurred while configuring the App Store Connect integration'
);

export function getAppStoreValidationErrorMessage(
  error: AppStoreConnectValidationError,
  repo?: {link: string; name: string}
) {
  switch (error.code) {
    case 'app-connect-authentication-error':
      return repo
        ? tct(
            'App Store Connect credentials are invalid or missing. [linkToCustomRepository]',
            {
              linkToCustomRepository: (
                <Link to={repo.link}>
                  {tct(
                    "Make sure the credentials of the '[customRepositoryName]' repository are correct and exist.",
                    {
                      customRepositoryName: repo.name,
                    }
                  )}
                </Link>
              ),
            }
          )
        : t('The supplied App Store Connect credentials are invalid or missing.');
    case 'app-connect-forbidden-error':
      return t('The supplied API key does not have sufficient permissions.');
    case 'app-connect-multiple-sources-error':
      return t('Only one App Store Connect application is allowed in this project.');
    default: {
      // this shall not happen
      Sentry.captureException(new Error('Unknown app store connect error.'));
      return unexpectedErrorMessage;
    }
  }
}
