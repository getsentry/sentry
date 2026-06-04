import {lazy} from 'react';

import {withAutomationDetailsRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const IssueAlertRuleDetails = lazy(
  () => import('sentry/views/alerts/rules/issue/details/ruleDetails')
);

export default withAutomationDetailsRedirect(IssueAlertRuleDetails);
