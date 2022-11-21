import {customerDomain, usingCustomerDomain} from 'sentry/constants';
import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useParams() {
  const {params} = useRouteContext();

  if (usingCustomerDomain && customerDomain) {
    // We do not know if the caller of this hook requires orgId, so we populate orgId implicitly.
    return {...params, orgId: customerDomain};
  }

  return params;
}
