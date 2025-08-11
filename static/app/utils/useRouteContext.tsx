import {useContext} from 'react';

import {TestRouteContext} from 'sentry/views/routeContext';

/**
 * @deprecated
 *
 * DO NOT USE. This is currently only used to support our tests as we find a
 * way to transition our tests to a more react-router 6 style approach.
 */
export function useTestRouteContext() {
  return useContext(TestRouteContext);
}
