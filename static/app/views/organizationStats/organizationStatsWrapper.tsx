import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

type OrganizationStatsWrapperProps = {
  children: React.ReactNode;
};

// Wraps all routes under /stats/ to redirect to /settings/stats/
// Can be removed once navigation-sidebar-v2 is fully launched
export function OrganizationStatsWrapper({children}: OrganizationStatsWrapperProps) {
  const organization = useOrganization();

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/stats/',
    newPathPrefix: `/settings/${organization.slug}/stats/`,
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return children;
}
