import {useCallback, useState} from 'react';
import Cookies from 'js-cookie';

const REACT_AUTH_COOKIE = 'sentry_react_auth';

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
  const isAuthV2Enabled = authV2CookieState === AuthV2CookieState.ENABLED;

  const setAuthV2CookieState = useCallback((state: AuthV2CookieState) => {
    const domain = getCookieDomain();
    const secure = window.location.protocol === 'https:';
    const secureOptions: Cookies.CookieAttributes = {sameSite: 'none', secure: true};
    const laxOptions: Cookies.CookieAttributes = {sameSite: 'lax', domain};
    const options: Cookies.CookieAttributes = {
      path: '/',
      ...(secure ? secureOptions : laxOptions),
    };

    Cookies.remove(REACT_AUTH_COOKIE, {...options, path: '/auth/'});

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
  }, []);

  return {authV2CookieState, isAuthV2Enabled, setAuthV2CookieState};
}
