import {useCallback} from 'react';
import {parseAsString, useQueryStates} from 'nuqs';

import {buildDetectorZoomQuery, computeZoomRangeMs} from './buildDetectorZoomQuery';

export function useZoomToOpenPeriodRange(intervalSeconds?: number) {
  const [, setTimeParams] = useQueryStates(
    {start: parseAsString, end: parseAsString, statsPeriod: parseAsString},
    {history: 'push'}
  );

  return useCallback(
    (start: Date, end?: Date) => {
      const zoomRange = computeZoomRangeMs({
        startMs: start.getTime(),
        endMs: (end ?? new Date()).getTime(),
        intervalSeconds,
      });
      const zoomQuery = buildDetectorZoomQuery({}, zoomRange);

      setTimeParams({
        start: zoomQuery.start ?? null,
        end: zoomQuery.end ?? null,
        statsPeriod: zoomQuery.statsPeriod ?? null,
      });
    },
    [setTimeParams, intervalSeconds]
  );
}
