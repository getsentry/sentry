import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

import {PlatformizedMobileSessionsOverview} from './platformizedMobileOverview';
import {PlatformizedSessionsOverview} from './platformizedOverview';

function PageWithProviders() {
  const {view = ''} = useDomainViewFilters();

  if (view === MOBILE_LANDING_SUB_PATH) {
    return <PlatformizedMobileSessionsOverview />;
  }

  if (view === FRONTEND_LANDING_SUB_PATH) {
    return <PlatformizedSessionsOverview />;
  }

  return null;
}

export default PageWithProviders;
