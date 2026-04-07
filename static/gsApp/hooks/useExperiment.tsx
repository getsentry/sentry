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

  // Gate on organization.features so that SENTRY_FEATURES, self.feature(),
  // and devlocal.py all work without needing experiment-specific overrides.
  const inExperiment = organization.features.includes(feature);

  // Use organization.experiments only for exposure tracking — this field is
  // populated by get_experiment_assignments which requires the getsentry
  // entity handler and is empty in plain sentry / test environments.
  const assignment = organization.experiments?.[feature] ?? 'control';

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
