import {logout} from 'sentry/actionCreators/account';
import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';

const INACTIVITY_TIMEOUT_MS = 10 * 1000;

export function extraQueryParameter(): URLSearchParams {
  const extraQueryString = window.SandboxData?.extraQueryString || '';
  const extraQuery = new URLSearchParams(extraQueryString);
  return extraQuery;
}

export function extraQueryParameterWithEmail(): URLSearchParams {
  const params = extraQueryParameter();
  const email = localStorage.getItem('email');
  if (email) {
    params.append('email', email);
  }
  return params;
}

export function urlAttachQueryParams(url: string, params: URLSearchParams): string {
  const queryString = params.toString();
  if (queryString) {
    return url + '?' + queryString;
  }
  return url;
}

export function isDemoModeActive(): boolean {
  return ConfigStore.get('demoMode') && !isActiveSuperuser();
}

let inactivityTimeout: number | undefined;

window.addEventListener('blur', () => {
  if (isDemoModeActive()) {
    inactivityTimeout = window.setTimeout(() => {
      logout(new Client());
    }, INACTIVITY_TIMEOUT_MS);
  }
});

window.addEventListener('focus', () => {
  if (inactivityTimeout) {
    window.clearTimeout(inactivityTimeout);
    inactivityTimeout = undefined;
  }
});
