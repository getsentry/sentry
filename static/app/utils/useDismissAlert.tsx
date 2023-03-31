import {useCallback} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

type Opts = {
  /**
   * Key in localStorage.
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

function isValid(timestamp: number, expirationDays: number) {
  if (!timestamp || isNaN(timestamp)) {
    return false;
  }
  const duration = Date.now() - timestamp;
  const days = duration / MS_PER_DAY;
  return days < expirationDays;
}

/**
 * Nominally for tracking dismissal/acknowledgement of in-app alerts and
 * notifications, specifically those that don't need to be persisted server side.
 *
 * Dismissal can be 'permanent' or have an expiration after some number of days.
 *
 * The real lifecycle depends on whether users reset localStorage or not, if you
 * need something really permanent then save the users' preference to the server.
 */
function useDismissAlert({expirationDays = Number.MAX_SAFE_INTEGER, key}: Opts) {
  const [dismissedTimestamp, setDismissedTimestamp] = useLocalStorageState<
    undefined | string
  >(key, val => (val ? String(val) : undefined));

  const isDismissed =
    expirationDays === Number.MAX_SAFE_INTEGER
      ? Boolean(dismissedTimestamp)
      : isValid(Number(dismissedTimestamp), expirationDays);

  const dismiss = useCallback(() => {
    setDismissedTimestamp(Date.now().toString());
  }, [setDismissedTimestamp]);

  return {
    isDismissed,
    dismiss,
  };
}

export default useDismissAlert;
