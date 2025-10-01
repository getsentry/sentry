import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

/**
 * Returns the notification source from the URL route if available.
 * Also returns the base route to make building relative links easier
 */
export function useRouteSource() {
  const location = useLocation();
  const {notificationSource} = useParams<{notificationSource?: string}>();
  return {
    routeSource: notificationSource,
    baseRoute: notificationSource
      ? // Removes the last route segment. This is to ensure `/debug/notifications/` and
        // `/organizations/:slug/debug/notifications/` are valid as base routes
        // It does mean we'll have to change this if we add change the routes but works for now
        location.pathname.replace(/[\w-]+\/{0,1}$/, '')
      : location.pathname,
  };
}
