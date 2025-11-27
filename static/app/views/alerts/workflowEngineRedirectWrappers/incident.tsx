import {lazy} from 'react';

import {withOpenPeriodRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const AlertWizardProjectProvider = lazy(
  () => import('sentry/views/alerts/incidentRedirect')
);

export default withOpenPeriodRedirect(AlertWizardProjectProvider);
