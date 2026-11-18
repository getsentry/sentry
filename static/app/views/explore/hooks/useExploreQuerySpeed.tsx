import {useEffect} from 'react';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {QUERY_SPEEDS, type QuerySpeed} from 'sentry/components/querySpeedMenu';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

import {useGetSavedQuery} from './useGetSavedQueries';
import {SAMPLING_MODE, type SamplingMode} from './useProgressiveQuery';
import {Tab} from './useTab';

export type ExploreQuerySpeed = QuerySpeed;

const querySpeedParser = parseAsStringLiteral(QUERY_SPEEDS);

export function useExploreQuerySpeed(): {
  enabled: boolean;
  // False while a saved priority is still loading. A failed load is ready
  // and falls back to Balanced so charts and tables can run.
  isReady: boolean;
  // True when the saved query failed to load and the URL has no priority.
  loadFailed: boolean;
  // Extrapolation is off, or the traces or attribute breakdowns tab is open,
  // so the control stays on Balanced and cannot change.
  lockedToBalanced: boolean;
  samplingMode: SamplingMode | undefined;
  setSpeed: (speed: ExploreQuerySpeed) => void;
  speed: ExploreQuerySpeed;
} {
  const organization = useOrganization();
  const location = useLocation();
  const enabled = organization.features.includes('low-priority-queries');
  const [urlSpeed, setUrlSpeed] = useQueryState('queryPriority', querySpeedParser);
  const savedQueryId = decodeScalar(location.query.id);
  const samplesTab = decodeScalar(location.query.mode) !== Mode.AGGREGATE;
  const table = decodeScalar(location.query.table);
  const onUnsupportedTab =
    samplesTab && (table === Tab.TRACE || table === Tab.ATTRIBUTE_BREAKDOWNS);
  const lockedToBalanced =
    enabled && (decodeScalar(location.query.extrapolate) === '0' || onUnsupportedTab);
  // An explicit URL value wins, including Balanced. The saved query fills in
  // only when the param is absent, so a bookmark that only has the id still
  // opens on the stored speed.
  const waitForSavedQuery =
    enabled && !lockedToBalanced && urlSpeed === null && defined(savedQueryId);
  const {
    data: savedQuery,
    isError,
    isFetched,
  } = useGetSavedQuery(waitForSavedQuery ? savedQueryId : undefined);
  const savedSpeed =
    savedQuery?.queryPriority === 'normal' || savedQuery?.queryPriority === 'faster'
      ? savedQuery.queryPriority
      : undefined;
  const speed: ExploreQuerySpeed =
    enabled && !lockedToBalanced ? (urlSpeed ?? savedSpeed ?? 'normal') : 'normal';

  useEffect(() => {
    // Drop Fast Querying while the control is locked so the URL matches Balanced.
    // Leave an explicit normal value in place, or a saved faster speed would
    // return once the lock lifts.
    if (lockedToBalanced && urlSpeed === 'faster') {
      setUrlSpeed(null);
    }
  }, [lockedToBalanced, setUrlSpeed, urlSpeed]);

  return {
    enabled,
    isReady: !waitForSavedQuery || isFetched,
    loadFailed: waitForSavedQuery && isError,
    lockedToBalanced,
    samplingMode: speed === 'faster' ? SAMPLING_MODE.LOW_PRIORITY : undefined,
    setSpeed: value => {
      if (enabled && !lockedToBalanced) {
        setUrlSpeed(value);
      }
    },
    speed,
  };
}
