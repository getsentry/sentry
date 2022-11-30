import {useMemo} from 'react';

import {customerDomain, usingCustomerDomain} from 'sentry/constants';
import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useParams<P = Record<string, string>>(): P {
  const contextParams = useRouteContext().params;

  // Memoize params as mutating for customer domains causes other hooks
  // that depend on `useParams()` to refresh infinitely.
  return useMemo(() => {
    if (usingCustomerDomain && customerDomain && contextParams.orgId === undefined) {
      // We do not know if the caller of this hook requires orgId, so we populate orgId implicitly.
      return {...contextParams, orgId: customerDomain};
    }
    return contextParams;
  }, [contextParams]);
}
