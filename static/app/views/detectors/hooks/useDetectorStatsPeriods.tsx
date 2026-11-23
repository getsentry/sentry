import {useEffect} from 'react';
import isEqual from 'lodash/isEqual';
import {useQueryStates} from 'nuqs';

import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {widenDateRangeToInterval} from 'sentry/views/detectors/utils/widenDateRangeToInterval';

export const useDetectorStatsPeriods = (intervalSeconds: number) => {
  const [{statsPeriod, start, end}, setDateRange] = useQueryStates(pageFilterParsers);

  useEffect(() => {
    if (!intervalSeconds) {
      return;
    }

    const dateRange = {
      statsPeriod: statsPeriod || undefined,
      start: start || undefined,
      end: end || undefined,
    };

    const widenedDateRange = widenDateRangeToInterval({
      dateRange,
      intervalSeconds,
      nowMilliseconds: Date.now(),
    });

    if (isEqual(widenedDateRange, dateRange)) {
      return;
    }

    // Replace so the back button skips the range that was too short to chart
    setDateRange(
      {
        statsPeriod: widenedDateRange.statsPeriod ?? null,
        start: widenedDateRange.start ?? null,
        end: widenedDateRange.end ?? null,
      },
      {history: 'replace'}
    );
  }, [statsPeriod, start, end, intervalSeconds, setDateRange]);
};
