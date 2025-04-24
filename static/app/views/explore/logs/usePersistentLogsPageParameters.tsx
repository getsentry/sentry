import {useEffect} from 'react';
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
      navigate(target);
    }
  }, [location, navigate, persistedParams]);
}
