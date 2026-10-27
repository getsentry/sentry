import {useEffect} from 'react';
import {matchPath} from 'react-router';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {useLocation} from 'sentry/utils/useLocation';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

const SETTINGS_RETURN_PATH_KEY = 'settings-return-path';

/**
 * Remembers the last page the user visited outside of Settings, so "Back to
 * app" can return there. Browser history is not reliable for this because
 * users navigate between several settings pages before leaving.
 *
 * Must be mounted outside of the settings-only navigation.
 */
export function useCaptureSettingsReturnPath() {
  const settingsV3 = useSettingsV3();
  const {pathname, search, hash} = useLocation();

  useEffect(() => {
    if (!settingsV3 || matchPath({path: '/settings', end: false}, pathname)) {
      return;
    }
    sessionStorageWrapper.setItem(
      SETTINGS_RETURN_PATH_KEY,
      `${pathname}${search}${hash}`
    );
  }, [settingsV3, pathname, search, hash]);
}

/**
 * The page the user entered Settings from, or `fallback` when Settings was
 * entered directly.
 */
export function getSettingsReturnPath(fallback: string): string {
  return sessionStorageWrapper.getItem(SETTINGS_RETURN_PATH_KEY) ?? fallback;
}
