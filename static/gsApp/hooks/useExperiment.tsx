import {useEffect} from 'react';
import * as Amplitude from '@amplitude/analytics-browser';
import {useMutation} from '@tanstack/react-query';

import {ConfigStore} from 'sentry/stores/configStore';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {UseExperimentOptions, UseExperimentResult} from 'sentry/utils/useExperiment';
import {useOrganization} from 'sentry/utils/useOrganization';

const reportedExposures = new Set<string>();

/**
 * Mirrors the backend transform in getsentry/experiments/tasks.py so both
 * paths write the same property name to the same org group.
 */
function amplitudeGroupPropertyName(feature: string) {
  return `experiment_${feature.replace(/-/g, '_')}`;
}

/**
 * Set the experiment group property on the browser-side Amplitude SDK so
 * the next tracked event has it available at ingestion. The backend POST
 * also writes this property via Amplitude's groupidentify HTTP endpoint,
 * but that path (browser → Sentry → taskbroker → worker → Amplitude) is
 * too slow to win the race against events fired on the same mount.
 */
function setAmplitudeExperimentGroupProperty(
  organizationId: string,
  feature: string,
  assignment: string
) {
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }
  const identify = new Amplitude.Identify().set(
    amplitudeGroupPropertyName(feature),
    assignment
  );
  Amplitude.groupIdentify('organization_id', organizationId, identify);
}

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
    setAmplitudeExperimentGroupProperty(organization.id, feature, assignment);
    logExposure();
  }, [
    reportExposure,
    organization.id,
    organization.slug,
    feature,
    assignment,
    logExposure,
  ]);

  return {inExperiment, experimentAssignment: assignment};
}
