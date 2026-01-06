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
  | 'alertId'
  | 'alertType'
  | 'apiKey'
  | 'appId'
  | 'appSlug'
  | 'authId'
  | 'automationId'
  | 'codeId'
  | 'dashboardId'
  | 'dataForwarderId'
  | 'dataExportId'
  | 'detectorId'
  | 'docIntegrationSlug'
  | 'eventId'
  | 'eventSlug'
  | 'fineTuneType'
  | 'groupId'
  | 'id'
  | 'installationId'
  | 'integrationId'
  | 'integrationSlug'
  | 'issueId'
  | 'memberId'
  | 'notificationSource'
  | 'orgId'
  | 'projectId'
  | 'providerKey'
  | 'regionName'
  | 'release'
  | 'relocationUuid'
  | 'replaySlug'
  | 'repoId'
  | 'ruleId'
  | 'scrubbingId'
  | 'searchId'
  | 'sentryAppSlug'
  | 'shareId'
  | 'spanSlug'
  | 'step'
  | 'tagKey'
  | 'teamId'
  | 'templateId'
  | 'tokenId'
  | 'traceSlug'
  | 'userId'
  | 'viewId'
  | 'widgetIndex';

/**
 * Get params from the current route. Param availability depends on the current route.
 *
 * @example
 * ```tsx
 * const params = useParams<{projectId: string}>();
 * ```
 */
export function useParams<P extends Partial<Record<ParamKeys, string | undefined>>>(): P {
  // When running in test mode we still read from the legacy route context to
  // keep test compatability while we fully migrate to react router 6
  const testRouteContext = useTestRouteContext();

  let contextParams: any;

  if (testRouteContext) {
    contextParams = testRouteContext.params;
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    contextParams = useReactRouter6Params();
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
