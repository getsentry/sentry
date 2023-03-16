import {useEffect, useRef} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function useReplayPageview(type: 'replay.details-time-spent' | 'replay.list-time-spent') {
  const config = useLegacyStore(ConfigStore);
  const location = useLocation();
  const organization = useOrganization();
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const startTime = startTimeRef.current;

    trackAdvancedAnalyticsEvent('replay.details-viewed', {
      organization,
      referrer: decodeScalar(location.query.referrer),
      user_email: config.user.email,
    });

    return () => {
      const endTime = Date.now();
      trackAdvancedAnalyticsEvent(type, {
        organization,
        seconds: (endTime - startTime) / 1000,
        user_email: config.user.email,
      });
    };
  }, [organization, type, location.query.referrer, config.user.email]);
}

export default useReplayPageview;
