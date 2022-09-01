import {useEffect} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function useReplayPageview() {
  const config = useLegacyStore(ConfigStore);
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    trackAdvancedAnalyticsEvent('replay-details.viewed', {
      organization,
      referrer: decodeScalar(location.query.referrer),
      user_email: config.user.email,
    });
  }, [organization, location.query.referrer, config.user.email]);
}

export default useReplayPageview;
