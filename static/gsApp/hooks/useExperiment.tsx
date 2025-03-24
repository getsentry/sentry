import {useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {experimentConfig, unassignedValue} from 'sentry/data/experimentConfig';
import type {
  ExperimentAssignment,
  ExperimentKey,
  OrgExperiments,
  UserExperiments,
} from 'sentry/types/experiments';
import {ExperimentType} from 'sentry/types/experiments';
import {defined} from 'sentry/utils';
import type {UseExperiment} from 'sentry/utils/useExperiment';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import logExperimentAnalytics from 'getsentry/utils/logExperiment';

function useExperimentAssignment<E extends ExperimentKey>(
  experiment: E
): ExperimentAssignment[E] | typeof unassignedValue {
  const organization = useOrganization();
  const user = useUser();
  const config = experimentConfig[experiment];

  if (!config) {
    Sentry.withScope(scope => {
      scope.setExtra('experiment', experiment);
      Sentry.captureMessage(
        'useExperiment called with an experiment that does not exist in the config.'
      );
    });

    return unassignedValue;
  }

  if (config.type === ExperimentType.ORGANIZATION) {
    const key = experiment as keyof OrgExperiments;
    const assignment = organization.experiments?.[key];
    if (!defined(assignment)) {
      Sentry.withScope(scope => {
        scope.setExtra('experiment', experiment);
        scope.setExtra('orgExperiments', organization.experiments);
        Sentry.captureMessage(
          'useExperiment called with org experiment but no matching experiment exists on the org.'
        );
      });

      return unassignedValue;
    }

    return assignment as ExperimentAssignment[E];
  }

  if (config.type === ExperimentType.USER) {
    const key = experiment as keyof UserExperiments;
    const assignment = user?.experiments?.[key];
    if (!defined(assignment)) {
      Sentry.withScope(scope => {
        scope.setExtra('experiment', experiment);
        scope.setExtra('userExperiments', user?.experiments);
        Sentry.captureMessage(
          'useExperiment called with user experiment but no matching experiment exists on the user.'
        );
      });

      return unassignedValue;
    }

    return assignment as ExperimentAssignment[E];
  }

  return unassignedValue;
}

export const useExperiment: UseExperiment = (
  experiment,
  {logExperimentOnMount = true} = {}
) => {
  const organization = useOrganization();

  const logExperiment = useCallback(() => {
    logExperimentAnalytics({
      key: experiment,
      organization,
    });
  }, [experiment, organization]);

  useEffect(() => {
    if (logExperimentOnMount) {
      logExperiment();
    }
  }, [logExperiment, logExperimentOnMount]);

  const experimentAssignment = useExperimentAssignment(experiment);

  return {
    experimentAssignment,
    logExperiment,
  };
};
