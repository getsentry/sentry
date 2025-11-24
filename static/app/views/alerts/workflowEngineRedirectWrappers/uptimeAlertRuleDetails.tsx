import {lazy} from 'react';

import {withDetectorDetailsRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const UptimeAlertDetails = lazy(() => import('sentry/views/alerts/rules/uptime/details'));

export default withDetectorDetailsRedirect(UptimeAlertDetails);
