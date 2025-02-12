import {useLocation} from 'react-router-dom';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  newPathPrefix: `/${string}`;
  oldPathPrefix: `/${string}`;
};

function useShouldRedirect(oldPathPrefix: `/${string}`) {
  const organization = useOrganization();
  const location = useLocation();

  if (USING_CUSTOMER_DOMAIN) {
    return location.pathname.startsWith(oldPathPrefix);
  }

  return location.pathname.startsWith(
    `/organizations/${organization.slug}${oldPathPrefix}`
  );
}

/**
 * Helps determine if we are on a legacy route and should redirect to the new route.
 * Some products have been moved under new groups, such as feedback -> issues/feedback
 * and discover -> explore/discover. When the v2 navigation is enabled, we need to
 * enforce the new routes.
 *
 * Example:
 *
 * /feedback/123 -> /issues/feedback/123/
 * /issues/feedback/123/ -> null (no redirect)
 */
export function useRedirectNavV2Routes({
  oldPathPrefix,
  newPathPrefix,
}: Props): string | null {
  const location = useLocation();
  const organization = useOrganization();
  const hasNavigationV2 = organization.features.includes('navigation-sidebar-v2');
  const shouldRedirect = useShouldRedirect(oldPathPrefix);

  if (!hasNavigationV2 || !shouldRedirect) {
    return null;
  }

  if (USING_CUSTOMER_DOMAIN) {
    return (
      location.pathname.replace(new RegExp(`^${oldPathPrefix}`), newPathPrefix) +
      location.search +
      location.hash
    );
  }

  return (
    location.pathname.replace(
      new RegExp(`^/organizations/${organization.slug}${oldPathPrefix}`),
      `/organizations/${organization.slug}${newPathPrefix}`
    ) +
    location.search +
    location.hash
  );
}
