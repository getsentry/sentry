import {lazy} from 'react';

import {withDetectorDetailsRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const MetricAlertDetails = lazy(() => import('sentry/views/alerts/rules/metric/details'));

export default withDetectorDetailsRedirect(MetricAlertDetails);
