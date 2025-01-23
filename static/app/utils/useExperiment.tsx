import noop from 'lodash/noop';

import {unassignedValue} from 'sentry/data/experimentConfig';
import HookStore from 'sentry/stores/hookStore';
import type {ExperimentAssignment, ExperimentKey} from 'sentry/types/experiments';

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
  experimentAssignment: ExperimentAssignment[E] | typeof unassignedValue;
  /**
   * Call this method when the user has been exposed to the experiment.
   * You do not need to call this unless you have disabled logging on mount.
   */
  logExperiment: () => void;
};

export type UseExperiment = <E extends ExperimentKey>(
  experiment: E,
  options?: UseExperimentOptions
) => UseExperimentReturnValue<E>;

export const useExperiment: UseExperiment = (...params) => {
  return (
    HookStore.get('react-hook:use-experiment')[0]?.(...params) ?? {
      experimentAssignment: unassignedValue,
      logExperiment: noop,
    }
  );
};
