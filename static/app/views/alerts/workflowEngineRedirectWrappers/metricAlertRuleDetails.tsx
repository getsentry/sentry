import {
  MonitorsListRedirect,
  withDetectorDetailsRedirect,
  withMetricIssueRedirect,
} from 'sentry/views/alerts/workflowEngineRedirects';

export default withMetricIssueRedirect(withDetectorDetailsRedirect(MonitorsListRedirect));
