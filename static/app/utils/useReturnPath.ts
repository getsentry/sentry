import {useEffect} from 'react';
import {matchPath} from 'react-router';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {useLocation} from 'sentry/utils/useLocation';

interface CaptureReturnPathOptions {
  /**
   * Locations under this path prefix (e.g. `/settings`) are not captured.
   */
  excludePrefix: string;
  /**
   * The session storage key the return path is stored under.
   */
  key: string;
}

/**
 * Remembers the last page the user visited outside of a section of the app, so
 * a "back" control inside that section can return there. Browser history is
 * not reliable for this because users navigate between several pages of the
 * section before leaving.
 *
 * Must be mounted outside of the section it excludes.
 */
export function useCaptureReturnPath({key, excludePrefix}: CaptureReturnPathOptions) {
  const {pathname, search, hash} = useLocation();

  useEffect(() => {
    if (matchPath({path: excludePrefix, end: false}, pathname)) {
      return;
    }
    sessionStorageWrapper.setItem(key, `${pathname}${search}${hash}`);
  }, [key, excludePrefix, pathname, search, hash]);
}

/**
 * The page captured by `useCaptureReturnPath`, or `fallback` when none was
 * captured, e.g. when the section was entered directly.
 */
export function getReturnPath(key: string, fallback: string): string {
  return sessionStorageWrapper.getItem(key) ?? fallback;
}
