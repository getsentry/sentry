import {useQuery} from '@tanstack/react-query';
import {useMutation} from '@tanstack/react-query';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

export type DetectorHealthCheckResponse = {
  organization: Record<string, Detector>;
  projects: Record<string, Record<string, Detector>> | null;
};

/**
 * Runs a detector health check against the sentry API. The check verifies
 * that all system detectors exist for the org (and optionally a set
 * of projects), creating them if necessary.
 */
export function useDetectorHealthCheck({
  orgSlug,
  projectIds = [],
}: {
  orgSlug: string;
  projectIds?: string[];
}) {
  const url = getApiUrl('/organizations/$organizationIdOrSlug/detectors/health-check/', {
    path: {organizationIdOrSlug: orgSlug},
  });
  const data = projectIds.length ? {} : {projects: projectIds};

  return useMutation({
    mutationFn: () => {
      return fetchMutation<DetectorHealthCheckResponse>({method: 'POST', url, data});
    },
    onMutate: () => {
      addLoadingMessage(t('Performing health check...'));
    },
    onSuccess: ({organization: organizationDetectors, projects}) => {
      const organizationLevelCount = Object.values(organizationDetectors).length;
      let summaryMessage = `Organization has ${organizationLevelCount} system detectors.`;
      Object.entries(projects ?? {}).forEach(([slug, projectDetectors]) => {
        const projectLevelCount = Object.values(projectDetectors).length;
        summaryMessage.concat(
          ` Project '${slug}' has ${projectLevelCount} system detectors`
        );
      });
      addSuccessMessage(`Detector health check completed. ${summaryMessage}`);
    },
    onError: (error: Error) => {
      if (error instanceof RequestError && error.responseJSON) {
        addErrorMessage(
          `Detector health check failed: ${JSON.stringify(error.responseJSON)}`
        );
      } else {
        addErrorMessage(`Detector health check failed.`);
      }
    },
  });
}
