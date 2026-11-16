import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useGetSavedQuery} from './useGetSavedQueries';
import {SAMPLING_MODE, type SamplingMode} from './useProgressiveQuery';

const EXPLORE_QUERY_SPEEDS = ['normal', 'faster'] as const;

export type ExploreQuerySpeed = (typeof EXPLORE_QUERY_SPEEDS)[number];

const querySpeedParser = parseAsStringLiteral(EXPLORE_QUERY_SPEEDS);

export function useExploreQuerySpeed(): {
  enabled: boolean;
  // False while a saved priority is loading, and after that load fails.
  isReady: boolean;
  // True when the saved query failed to load and the URL has no priority.
  loadFailed: boolean;
  samplingMode: SamplingMode | undefined;
  setSpeed: (speed: ExploreQuerySpeed) => void;
  speed: ExploreQuerySpeed;
} {
  const organization = useOrganization();
  const location = useLocation();
  const enabled = organization.features.includes('low-priority-queries');
  const [urlSpeed, setUrlSpeed] = useQueryState('queryPriority', querySpeedParser);
  const savedQueryId = decodeScalar(location.query.id);
  // An explicit URL value wins, including Balanced. The saved query fills in
  // only when the param is absent, so a bookmark that only has the id still
  // opens on the stored speed.
  const waitForSavedQuery = enabled && urlSpeed === null && defined(savedQueryId);
  const {
    data: savedQuery,
    isError,
    isFetched,
  } = useGetSavedQuery(waitForSavedQuery ? savedQueryId : undefined);
  const savedSpeed =
    savedQuery?.queryPriority === 'normal' || savedQuery?.queryPriority === 'faster'
      ? savedQuery.queryPriority
      : undefined;
  const speed: ExploreQuerySpeed = enabled
    ? (urlSpeed ?? savedSpeed ?? 'normal')
    : 'normal';

  return {
    enabled,
    isReady: !waitForSavedQuery || (isFetched && !isError),
    loadFailed: waitForSavedQuery && isError,
    samplingMode: speed === 'faster' ? SAMPLING_MODE.LOW_PRIORITY : undefined,
    setSpeed: value => {
      if (enabled) {
        setUrlSpeed(value);
      }
    },
    speed,
  };
}
