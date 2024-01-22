import {useEffect, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

function useReplayPageview(type: 'replay.details-time-spent' | 'replay.list-time-spent') {
  const user = useUser();
  const organization = useOrganization();
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const startTime = startTimeRef.current;

    return () => {
      const endTime = Date.now();
      trackAnalytics(type, {
        organization,
        seconds: (endTime - startTime) / 1000,
        user_email: user.email,
      });
    };
  }, [organization, type, user.email]);
}

export default useReplayPageview;
