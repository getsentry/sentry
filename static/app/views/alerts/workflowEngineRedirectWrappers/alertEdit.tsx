import {lazy} from 'react';

import {withAutomationEditRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const AlertEdit = lazy(() => import('sentry/views/alerts/edit'));

export default withAutomationEditRedirect(AlertEdit);
