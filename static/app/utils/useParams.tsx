import {useMemo} from 'react';
import {useParams as useReactRouter6Params} from 'react-router-dom';

import {CUSTOMER_DOMAIN, USING_CUSTOMER_DOMAIN} from 'sentry/constants';

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
  | 'artifactId'
  | 'authId'
  | 'automationId'
  | 'baseArtifactId'
  | 'beaconId'
  | 'broadcastId'
  | 'clientID'
  | 'codeId'
  | 'conversationId'
  | 'dashboardId'
  | 'dataExportId'
  | 'dataForwarderId'
  | 'detectorId'
  | 'docIntegrationSlug'
  | 'eventId'
  | 'eventSlug'
  | 'fineTuneType'
  | 'groupId'
  | 'headArtifactId'
  | 'id'
  | 'installationId'
  | 'integrationId'
  | 'integrationSlug'
  | 'invoiceGuid'
  | 'issueId'
  | 'memberId'
  | 'notificationSource'
  | 'orgId'
  | 'policySlug'
  | 'projectId'
  | 'projectSlug'
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
  | 'snapshotId'
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
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function useParams<P extends Partial<Record<ParamKeys, string | undefined>>>(): P {
  const contextParams = useReactRouter6Params() as P;

  // Memoize params as mutating for customer domains causes other hooks
  // that depend on `useParams()` to refresh infinitely.
  return useMemo(() => {
    if (USING_CUSTOMER_DOMAIN && CUSTOMER_DOMAIN && contextParams.orgId === undefined) {
      // We do not know if the caller of this hook requires orgId, so we populate orgId implicitly.
      return {...contextParams, orgId: CUSTOMER_DOMAIN} as P;
    }
    return contextParams;
  }, [contextParams]);
}
