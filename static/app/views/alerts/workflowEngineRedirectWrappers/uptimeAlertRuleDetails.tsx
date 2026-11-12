import {lazy} from 'react';

import {withDetectorDetailsRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const UptimeAlertDetails = lazy(
  () => import('sentry/views/detectors/components/uptime/details')
);

export default withDetectorDetailsRedirect(UptimeAlertDetails);
