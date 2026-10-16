import {useEffect} from 'react';

import {navigateIfQueryChanged} from 'sentry/utils/navigateIfQueryChanged';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {widenDateRangeToInterval} from 'sentry/views/detectors/utils/widenDateRangeToInterval';

export const useDetectorStatsPeriods = (intervalSeconds: number) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!intervalSeconds) {
      return;
    }

    const dateRange = {
      statsPeriod: decodeScalar(location.query?.statsPeriod),
      start: decodeScalar(location.query?.start),
      end: decodeScalar(location.query?.end),
    };

    const widenedDateRange = widenDateRangeToInterval({
      dateRange,
      intervalSeconds,
      nowMilliseconds: Date.now(),
    });

    // Replace so the back button skips the range that was too short to chart
    navigateIfQueryChanged(
      navigate,
      location,
      {query: {...location.query, ...widenedDateRange}},
      {replace: true}
    );
  }, [location, navigate, intervalSeconds]);
};
