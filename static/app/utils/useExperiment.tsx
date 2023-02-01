import {useCallback, useEffect} from 'react';

import {experimentConfig, unassignedValue} from 'sentry/data/experimentConfig';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {
  ExperimentAssignment,
  ExperimentKey,
  ExperimentType,
  OrgExperiments,
  UserExperiments,
} from 'sentry/types/experiments';
import {logExperiment as logExperimentAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

type UseExperimentOptions = {
  /**
   * By default this hook will log the exposure of the experiment upon mounting
   * of the component.
   *
   * If this is undesirable, for example if the experiment is hidden behind
   * some user action beyond this component being mounted, then you will want
   * to customize when exposure to the experiment has been logged.
   *
   * NOTE: If set to false, YOU ARE RESPONSIBLE for logging exposure of the
   *       experiment!! If you do not log exposure your experiment will not be
   *       correct!!
   */
  logExperimentOnMount?: boolean;
};

type UseExperimentReturnValue<E extends ExperimentKey> = {
  experimentAssignment: ExperimentAssignment[E];
  /**
   * Call this method when the user has been exposed to the experiment.
   * You do not need to call this unless you have disabled logging on mount.
   */
  logExperiment: () => void;
};

function useExperimentAssignment(experiment: ExperimentKey) {
  const organization = useOrganization();
  const {user} = useLegacyStore(ConfigStore);
  const {type} = experimentConfig[experiment];

  if (type === ExperimentType.Organization) {
    const key = experiment as keyof OrgExperiments;
    return organization?.experiments?.[key] ?? unassignedValue;
  }

  if (type === ExperimentType.User) {
    const key = experiment as keyof UserExperiments;
    return user?.experiments?.[key] ?? unassignedValue;
  }

  return unassignedValue;
}

export function useExperiment<E extends ExperimentKey>(
  experiment: E,
  {logExperimentOnMount = true}: UseExperimentOptions = {}
): UseExperimentReturnValue<E> {
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
}
