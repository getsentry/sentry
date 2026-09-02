import {useCallback, useState} from 'react';
import Cookies from 'js-cookie';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

const REACT_AUTH_COOKIE = 'sentry_react_auth';
const AUTH_V2_ROLLOUT_ORGANIZATION = 'sentry_react_auth_rollout_organization';

export enum AuthV2CookieState {
  DISABLED = 'disabled',
  ENABLED = 'enabled',
  UNSET = 'unset',
}

export function getAuthV2CookieState() {
  const value = Cookies.get(REACT_AUTH_COOKIE);

  if (value === '1') {
    return AuthV2CookieState.ENABLED;
  }

  if (value === '0') {
    return AuthV2CookieState.DISABLED;
  }

  return AuthV2CookieState.UNSET;
}

function getCookieDomain() {
  const {hostname} = window.location;

  if (hostname === 'sentry.io' || hostname.endsWith('.sentry.io')) {
    return '.sentry.io';
  }

  if (hostname === 'dev.getsentry.net' || hostname.endsWith('.dev.getsentry.net')) {
    return '.dev.getsentry.net';
  }

  return;
}

export function useEnableAuthV2() {
  const [authV2CookieState, setAuthV2CookieStateValue] = useState(getAuthV2CookieState);
  const [authV2RolloutOrganization, setAuthV2RolloutOrganization] =
    useSyncedLocalStorageState<string | null>(AUTH_V2_ROLLOUT_ORGANIZATION, null);
  const isAuthV2Enabled = authV2CookieState === AuthV2CookieState.ENABLED;

  const setAuthV2CookieState = useCallback(
    (state: AuthV2CookieState, rolloutOrganization: string | null = null) => {
      const domain = getCookieDomain();
      const secure = window.location.protocol === 'https:';
      const options: Cookies.CookieAttributes = {
        path: '/',
        sameSite: secure ? 'none' : 'lax',
        ...(secure ? {secure: true} : {}),
        ...(domain ? {domain} : {}),
      };

      Cookies.remove(REACT_AUTH_COOKIE, {...options, path: '/auth/'});
      setAuthV2RolloutOrganization(rolloutOrganization);

      if (state === AuthV2CookieState.UNSET) {
        Cookies.remove(REACT_AUTH_COOKIE, options);
      } else {
        Cookies.set(
          REACT_AUTH_COOKIE,
          state === AuthV2CookieState.ENABLED ? '1' : '0',
          options
        );
      }

      setAuthV2CookieStateValue(state);
    },
    [setAuthV2RolloutOrganization]
  );

  return {
    authV2CookieState,
    authV2RolloutOrganization,
    isAuthV2Enabled,
    setAuthV2CookieState,
  };
}
