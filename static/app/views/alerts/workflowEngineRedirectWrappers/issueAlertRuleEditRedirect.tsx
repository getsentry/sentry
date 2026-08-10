import {
  AutomationsListRedirect,
  withAutomationEditRedirect,
} from 'sentry/views/alerts/workflowEngineRedirects';

export default withAutomationEditRedirect(AutomationsListRedirect);
