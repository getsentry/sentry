import {Outlet} from 'react-router-dom';

import {Redirect} from 'sentry/components/redirect';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

// Wraps all routes under /stats/ to redirect to /settings/stats/
// Can be removed once navigation-sidebar-v2 is fully launched
export function OrganizationStatsWrapper() {
  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/stats/',
    newPathPrefix: `/settings/stats/`,
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return <Outlet />;
}
