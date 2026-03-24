import {lazy} from 'react';

import {
  withDetectorDetailsRedirect,
  withMetricIssueRedirect,
} from 'sentry/views/alerts/workflowEngineRedirects';

const MetricAlertDetails = lazy(() => import('sentry/views/alerts/rules/metric/details'));

export default withMetricIssueRedirect(withDetectorDetailsRedirect(MetricAlertDetails));
