import {
  MonitorsListRedirect,
  withOpenPeriodRedirect,
} from 'sentry/views/alerts/workflowEngineRedirects';

export default withOpenPeriodRedirect(MonitorsListRedirect);
