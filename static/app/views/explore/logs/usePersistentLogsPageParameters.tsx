import {useEffect, useRef} from 'react';
import type {Location} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  LOGS_FIELDS_KEY,
  usePersistedLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOGS_SORT_BYS_KEY,
  updateLocationWithLogSortBys,
} from 'sentry/views/explore/contexts/logs/sortBys';

/**
 *
 * This is a react component which sets the table columns and sorts from storage if they are unset.
 */
export function usePersistentLogsPageParameters() {
  const location = useLocation();
  const navigate = useNavigate();
  const [persistedParams] = usePersistedLogsPageParams();

  // The first render for setting these params in the URL should replace the current URL
  // to avoid adding extra entries to the history stack that lead to a re-init state (i.e.
  // a URL state where these props need to be re-applied, blocking back navigation)
  const firstRender = useRef(true);
  useEffect(() => {
    let changedSomething = false;
    const target: Location = {...location, query: {...location.query}};
    if (!target.query[LOGS_FIELDS_KEY] && persistedParams?.fields?.length > 0) {
      target.query[LOGS_FIELDS_KEY] = persistedParams.fields;
      changedSomething = !!target.query[LOGS_FIELDS_KEY];
    }
    if (!target.query[LOGS_SORT_BYS_KEY] && persistedParams?.sortBys?.length > 0) {
      updateLocationWithLogSortBys(target, persistedParams.sortBys);
      changedSomething = !!target.query[LOGS_SORT_BYS_KEY];
    }
    if (changedSomething) {
      navigate(target, {replace: firstRender.current});
      firstRender.current = false;
    }
  }, [location, navigate, persistedParams]);
}
