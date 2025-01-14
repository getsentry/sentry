import {useMemo} from 'react';
import {useParams as useReactRouter6Params} from 'react-router-dom';

import {CUSTOMER_DOMAIN, USING_CUSTOMER_DOMAIN} from 'sentry/constants';

import {useTestRouteContext} from './useRouteContext';

/**
 * List of keys used in routes.tsx `/example/:paramKey/...`
 *
 * Prevents misspelling of param keys
 */
type ParamKeys =
  | 'apiKey'
  | 'dataExportId'
  | 'eventId'
  | 'groupId'
  | 'id'
  | 'installationId'
  | 'integrationSlug'
  | 'issueId'
  | 'memberId'
  | 'orgId'
  | 'projectId'
  | 'release'
  | 'scrubbingId'
  | 'searchId'
  | 'sentryAppSlug'
  | 'shareId'
  | 'spanSlug'
  | 'teamId'
  | 'widgetIndex';

/**
 * Get params from the current route. Param availability depends on the current route.
 *
 * @example
 * ```tsx
 * const params = useParams<{projectId: string}>();
 * ```
 */
export function useParams<P = Partial<Record<ParamKeys, string | undefined>>>(): P {
  // When running in test mode we still read from the legacy route context to
  // keep test compatability while we fully migrate to react router 6
  const testRouteContext = useTestRouteContext();

  let contextParams: any;

  if (!testRouteContext) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    contextParams = useReactRouter6Params();
  } else {
    contextParams = testRouteContext.params;
  }

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
