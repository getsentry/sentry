import ConfigStore from 'sentry/stores/configStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';

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
  return true;
  return ConfigStore.get('demoMode') && !isActiveSuperuser();
}
