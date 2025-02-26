import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useLastKnownRoute} from 'sentry/views/lastKnownRouteContextProvider';

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
 * All links should use the new paths (e.g. /profiling -> /explore/profiling).
 * This creates a Sentry issue if we detect any links that haven't been updated.
 */
function useLogUnexpectedNavigationRedirect({shouldRedirect}: {shouldRedirect: boolean}) {
  const lastKnownRoute = useLastKnownRoute();
  const route = useRoutes();
  const routeString = getRouteStringFromRoutes(route);

  useEffect(() => {
    if (shouldRedirect && lastKnownRoute !== routeString) {
      Sentry.captureMessage('Unexpected navigation redirect', {
        level: 'warning',
        tags: {
          last_known_route: lastKnownRoute,
          route: routeString,
        },
      });
    }
  }, [lastKnownRoute, shouldRedirect, routeString]);
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
  const prefersStackedNav = usePrefersStackedNav();
  const shouldRedirect = useShouldRedirect(oldPathPrefix);

  useLogUnexpectedNavigationRedirect({shouldRedirect});

  if (!prefersStackedNav || !shouldRedirect) {
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
