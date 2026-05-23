import Cookies from 'js-cookie';

import {redirectToProject} from 'sentry/actionCreators/redirectToProject';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {EXPERIMENTAL_SPA} from 'sentry/constants';
import {SUDO_REQUIRED, SUPERUSER_REQUIRED} from 'sentry/constants/apiErrorCodes';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

import type {ApiResponse, SentryCellFetchErrorHandlers} from './sentryCellFetch';

const ALLOWED_ANON_PAGES = [
  /^\/accept\//,
  /^\/share\//,
  /^\/auth\/login\//,
  /^\/join-request\//,
  /^\/unsubscribe\//,
];

const CODES_TO_SKIP = [
  'sudo-required',
  'ignore',
  '2fa-required',
  'app-connect-authentication-error',
];

export interface DefaultErrorHandlerOptions {
  navigate: ReactRouter3Navigate;
}

export function createDefaultAuthErrorHandler(
  options: DefaultErrorHandlerOptions
): NonNullable<SentryCellFetchErrorHandlers['onAuthError']> {
  return (response, requestOptions) => {
    const pageAllowsAnon = ALLOWED_ANON_PAGES.some(regex =>
      regex.test(window.location.pathname)
    );
    if (pageAllowsAnon) {
      return false;
    }

    if (requestOptions.allowAuthError) {
      return false;
    }

    const code = response?.responseJSON?.detail?.code;
    const extra = response?.responseJSON?.detail?.extra;

    if (CODES_TO_SKIP.includes(code)) {
      return false;
    }

    if (code === 'sso-required') {
      testableWindowLocation.assign(extra.loginUrl);
      return true;
    }

    if (code === 'member-disabled-over-limit') {
      options.navigate(extra.next, {replace: true});
      return true;
    }

    if (!isDemoModeActive()) {
      Cookies.set('session_expired', '1');
    }

    if (EXPERIMENTAL_SPA) {
      options.navigate('/auth/login/', {replace: true});
    } else {
      testableWindowLocation.reload();
    }
    return true;
  };
}

export function createDefaultSudoHandler(): NonNullable<
  SentryCellFetchErrorHandlers['onSudoRequired']
> {
  return (response, retry) => {
    const code = response?.responseJSON?.detail?.code;

    return new Promise<ApiResponse>((resolve, reject) => {
      let didSuccessfullyRetry = false;

      openSudo({
        isSuperuser: code === SUPERUSER_REQUIRED,
        sudo: code === SUDO_REQUIRED,
        retryRequest: async () => {
          try {
            const result = await retry();
            didSuccessfullyRetry = true;
            resolve(result);
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        onClose: () => {
          if (!didSuccessfullyRetry) {
            reject(
              new RequestError(undefined, '', new Error('Sudo modal closed'), response)
            );
          }
        },
      });
    });
  };
}

export function createDefaultProjectRenamedHandler(): NonNullable<
  SentryCellFetchErrorHandlers['onProjectRenamed']
> {
  return response => {
    const slug = response?.responseJSON?.detail?.extra?.slug;
    redirectToProject(slug);
    return true;
  };
}

export function createDefaultErrorHandlers(
  options: DefaultErrorHandlerOptions
): SentryCellFetchErrorHandlers {
  return {
    onAuthError: createDefaultAuthErrorHandler(options),
    onSudoRequired: createDefaultSudoHandler(),
    onProjectRenamed: createDefaultProjectRenamedHandler(),
  };
}
