import {useCallback, useState} from 'react';
import Cookies from 'js-cookie';

const REACT_AUTH_COOKIE = 'sentry_react_auth';

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
  const [isAuthV2Enabled, setIsAuthV2Enabled] = useState(
    () => Cookies.get(REACT_AUTH_COOKIE) === '1'
  );

  const setAuthV2Enabled = useCallback((enabled: boolean) => {
    const domain = getCookieDomain();
    const options = {
      path: '/',
      sameSite: 'lax' as const,
      ...(domain ? {domain} : {}),
    };

    if (enabled) {
      Cookies.set(REACT_AUTH_COOKIE, '1', options);
    } else {
      Cookies.remove(REACT_AUTH_COOKIE, options);
      Cookies.remove(REACT_AUTH_COOKIE, {...options, path: '/auth/'});
    }

    setIsAuthV2Enabled(enabled);
  }, []);

  return {isAuthV2Enabled, setAuthV2Enabled};
}
