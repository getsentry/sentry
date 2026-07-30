import {useCallback} from 'react';
import type {Location} from 'history';

import {navigateIfQueryChanged} from 'sentry/utils/navigateIfQueryChanged';
import {decodeScalar} from 'sentry/utils/queryString';
import {useHasReplayAccess} from 'sentry/utils/replays/hooks/useHasReplayAccess';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useLogsFrozenIsFrozen} from 'sentry/views/explore/logs/logsFrozenContext';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';

export const LOGS_STORED_REPLAYS_ONLY_KEY = 'storedReplaysOnly';

/**
 * `has:replay_id` tokenizes under the `has` key rather than `replay_id`, so both
 * shapes have to be checked to know whether the query talks about replays at all.
 */
export function searchReferencesReplayId(search: MutableSearch) {
  return (
    search.hasFilter(OurLogKnownFieldKey.REPLAY_ID) ||
    search.getFilterValues('has').includes(OurLogKnownFieldKey.REPLAY_ID)
  );
}

/**
 * Whether the filter can do anything: the table isn't already scoped to a replay or
 * trace that exists, the query is about replays, and we're allowed to look replays up.
 */
export function useLogsStoredReplaysOnlyAvailable() {
  const search = useQueryParamsSearch();
  const isFrozen = useLogsFrozenIsFrozen();
  const hasReplayAccess = useHasReplayAccess();
  return !isFrozen && hasReplayAccess && searchReferencesReplayId(search);
}

/**
 * Deliberately gated on availability. Otherwise editing the replay filter out of the
 * query would hide the toggle while the URL param kept silently dropping rows, leaving
 * no control to turn it back off.
 */
export function useLogsStoredReplaysOnly() {
  const location = useLocation();
  const isAvailable = useLogsStoredReplaysOnlyAvailable();
  return (
    isAvailable && decodeScalar(location.query[LOGS_STORED_REPLAYS_ONLY_KEY]) === '1'
  );
}

export function useSetLogsStoredReplaysOnly() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (storedReplaysOnly: boolean) => {
      const target: Location = {...location, query: {...location.query}};
      if (storedReplaysOnly) {
        target.query[LOGS_STORED_REPLAYS_ONLY_KEY] = '1';
      } else {
        delete target.query[LOGS_STORED_REPLAYS_ONLY_KEY];
      }
      navigateIfQueryChanged(navigate, location, target);
    },
    [location, navigate]
  );
}
