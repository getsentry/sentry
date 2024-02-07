import {useMemo} from 'react';

import {CUSTOMER_DOMAIN, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useParams<P = Record<string, string>>(): P {
  const contextParams = useRouteContext().params;

  // Memoize params as mutating for customer domains causes other hooks
  // that depend on `useParams()` to refresh infinitely.
  return useMemo(() => {
    if (USING_CUSTOMER_DOMAIN && CUSTOMER_DOMAIN && contextParams.orgId === undefined) {
      // We do not know if the caller of this hook requires orgId, so we populate orgId implicitly.
      return {...contextParams, orgId: CUSTOMER_DOMAIN};
    }
    return contextParams;
  }, [contextParams]);
}
