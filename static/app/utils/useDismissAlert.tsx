import {useCallback, useEffect, useState} from 'react';

import localStorage from 'sentry/utils/localStorage';

type Opts = {
  /**
   * Key in localstorage.
   * Use a format like: `${organization.id}:my-feature`
   */
  key: string;

  /**
   * Number of days before the dismissal is expired.
   * After expiration the the user will need to re-dismiss things.
   */
  expirationDays?: number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Nominally for tracking dismissal/acknowledgement of in-app alerts and
 * notifications, specfically those that don't need to be persisted server side.
 *
 * Dismissal can be 'permanent' or have an expiration after some number of days.
 *
 * The real lifecycle depends on whether users reset localStorage or not, if you
 * need something really permanent then save the users' preference to the server.
 */
function useDismissAlert({expirationDays = Number.MAX_SAFE_INTEGER, key}: Opts) {
  const [isDismissed, setDismissed] = useState(false);

  useEffect(() => {
    const val = localStorage.getItem(key);

    if (expirationDays === Number.MAX_SAFE_INTEGER) {
      setDismissed(Boolean(val));
    } else if (val) {
      const timestamp = Number(val);
      if (isNaN(timestamp)) {
        localStorage.setItem(key, String(Date.now()));
        setDismissed(true);
      } else {
        const duration = Date.now() - timestamp;
        const days = duration / MS_PER_DAY;
        setDismissed(days < expirationDays);
      }
    }
  }, [key, expirationDays]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(key, String(Date.now()));
  }, [key]);

  return {isDismissed, dismiss};
}

export default useDismissAlert;
