import {useEffect} from 'react';

import {getDuration} from 'sentry/utils/duration/getDuration';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export const useDetectorStatsPeriods = (intervalSeconds: number) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!intervalSeconds) {
      return;
    }

    const statsPeriod = decodeScalar(location.query?.statsPeriod);
    const start = decodeScalar(location.query?.start);
    const end = decodeScalar(location.query?.end);

    let periodSeconds: number;
    if (statsPeriod) {
      periodSeconds = intervalToMilliseconds(statsPeriod) / 1000;
    } else if (start && end) {
      periodSeconds = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
    } else {
      return;
    }

    if (periodSeconds >= intervalSeconds) {
      return;
    }

    // If the url's period is smaller than the detector interval,
    // replace the period with the interval so subsequent lookups work.
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        start: undefined,
        end: undefined,
        statsPeriod: getDuration(intervalSeconds, 0, false, true),
      },
    });
  }, [location, navigate, intervalSeconds]);
};
