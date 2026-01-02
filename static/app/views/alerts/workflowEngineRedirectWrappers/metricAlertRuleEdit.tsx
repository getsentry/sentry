import {lazy} from 'react';

import {withDetectorEditRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const MetricAlertEdit = lazy(() => import('sentry/views/alerts/edit'));

export default withDetectorEditRedirect(MetricAlertEdit);
