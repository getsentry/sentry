import {lazy} from 'react';

import {withDetectorCreateRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const AlertCreate = lazy(() => import('sentry/views/alerts/create'));

export default withDetectorCreateRedirect(AlertCreate);
