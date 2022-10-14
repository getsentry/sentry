import Cookies from 'js-cookie';

import ConfigStore from 'sentry/stores/configStore';

const SUPERUSER_COOKIE_NAME = window.superUserCookieName ?? 'su';

/**
 * Checking for just isSuperuser on a config object may not be enough as backend often checks for *active* superuser.
 * We therefore check both isSuperuser flag AND superuser session cookie.
 */
export function isActiveSuperuser() {
  const {isSuperuser} = ConfigStore.get('user') || {};

  if (isSuperuser) {
    const superUserCookieName =
      ConfigStore.get('superUserCookieName') || SUPERUSER_COOKIE_NAME;
    /**
     * Superuser cookie cannot be checked for existence as it is HttpOnly.
     * As a workaround, we try to change it to something else and if that fails we can assume that it's being present.
     * There may be an edgecase where it's present and expired but for current usage it's not a big deal.
     */
    Cookies.set(superUserCookieName, 'test');

    if (Cookies.get(superUserCookieName) === undefined) {
      return true;
    }
  }

  return false;
}
