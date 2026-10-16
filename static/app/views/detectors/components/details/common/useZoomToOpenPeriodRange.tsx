import {useCallback} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  buildDetectorZoomQuery,
  computeZoomRangeMs,
} from 'sentry/views/detectors/components/details/common/buildDetectorZoomQuery';

export function useZoomToOpenPeriodRange(intervalSeconds?: number) {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (start: Date, end?: Date) => {
      const zoomRange = computeZoomRangeMs({
        startMs: start.getTime(),
        endMs: (end ?? new Date()).getTime(),
        intervalSeconds,
      });

      navigate({
        pathname: location.pathname,
        query: buildDetectorZoomQuery(location.query, zoomRange),
      });
    },
    [location.pathname, location.query, navigate, intervalSeconds]
  );
}
