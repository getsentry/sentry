import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';
import Redirect from 'sentry/components/redirect';

type OrganizationStatsWrapperProps = {
  children: React.ReactNode;
};

// Wraps all routes under /stats/ to redirect to /settings/stats/
// Can be removed once navigation-sidebar-v2 is fully launched
export function OrganizationStatsWrapper({children}: OrganizationStatsWrapperProps) {
  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/stats/',
    newPathPrefix: '/settings/stats/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return children;
}
