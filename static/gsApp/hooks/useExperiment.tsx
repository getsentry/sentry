import {useEffect} from 'react';

import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type {UseExperimentOptions, UseExperimentResult} from 'sentry/utils/useExperiment';
import {useOrganization} from 'sentry/utils/useOrganization';

const reportedExposures = new Set<string>();

/**
 * Used for testing, resets the exposure tracking set.
 * @public
 */
export function _resetExposureTracking() {
  reportedExposures.clear();
}

export function useExperiment(options: UseExperimentOptions): UseExperimentResult {
  const {feature, reportExposure = true} = options;
  const organization = useOrganization();

  const assignment = organization.experiments?.[feature] ?? 'control';
  const inExperiment = assignment === 'active';

  const {mutate: logExposure} = useMutation({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: `/organizations/${organization.slug}/experiment-exposure/`,
        data: {experimentName: feature, assignment},
      }),
    retry: false,
  });

  useEffect(() => {
    if (!reportExposure) {
      return;
    }

    const dedupKey = `${organization.slug}:${feature}:${assignment}`;
    if (reportedExposures.has(dedupKey)) {
      return;
    }

    reportedExposures.add(dedupKey);
    logExposure();
  }, [reportExposure, organization.slug, feature, assignment, logExposure]);

  return {inExperiment, experimentAssignment: assignment};
}
