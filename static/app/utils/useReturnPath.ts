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
   * The session storage key the return path is stored under. Nothing is
   * captured while this is null, e.g. when the key depends on something that
   * is not known yet.
   */
  key: string | null;
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
    if (key === null || matchPath({path: excludePrefix, end: false}, pathname)) {
      return;
    }
    sessionStorageWrapper.setItem(key, `${pathname}${search}${hash}`);
  }, [key, excludePrefix, pathname, search, hash]);
}

// A path on this site. Links treat `//host` and `/\host` as another site, and
// unmatched routes can capture such a pathname.
const SAME_ORIGIN_PATH = /^\/(?![/\\])/;

/**
 * The page captured by `useCaptureReturnPath`, or `fallback` when none was
 * captured, e.g. when the section was entered directly.
 */
export function getReturnPath(key: string, fallback: string): string {
  const path = sessionStorageWrapper.getItem(key);
  return path && SAME_ORIGIN_PATH.test(path) ? path : fallback;
}
