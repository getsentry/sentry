import {lazy} from 'react';

import {withDetectorCreateRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const AlertWizardProjectProvider = lazy(
  () => import('sentry/views/alerts/builder/projectProvider')
);

export default withDetectorCreateRedirect(AlertWizardProjectProvider);
