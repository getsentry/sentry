import {lazy} from 'react';

import {withDetectorCreateRedirect} from 'sentry/views/alerts/workflowEngineRedirects';

const UptimeExistingOrCreate = lazy(
  () => import('sentry/views/alerts/rules/uptime/existingOrCreate')
);

export default withDetectorCreateRedirect(UptimeExistingOrCreate);
