import {useEffect} from 'react';

import {getDuration} from 'sentry/utils/duration/getDuration';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export const useDetectorStatsPeriods = (intervalSeconds: number) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const statsPeriod = location.query?.statsPeriod;

    if (!statsPeriod || !intervalSeconds) {
      return;
    }

    const periodSeconds = intervalToMilliseconds(statsPeriod) / 1000;
    if (periodSeconds >= intervalSeconds) {
      return;
    }

    // If the url's period is smaller than the detector interval,
    // relace the period with the interval so subsequent lookups work.
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        statsPeriod: getDuration(intervalSeconds, 0, false, true),
      },
    });
  }, [location, navigate, intervalSeconds]);
};
