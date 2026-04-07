import {HookStore} from 'sentry/stores/hookStore';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface UseExperimentResult {
  /**
   * The raw assignment string from the backend (e.g. "active" or "control").
   * Useful for future multi-variant experiments where a simple boolean
   * isn't sufficient.
   */
  experimentAssignment: string;
  /**
   * Whether the current organization is in the experiment's active group.
   * True when the assignment is "active", false otherwise.
   */
  inExperiment: boolean;
}

export interface UseExperimentOptions {
  /**
   * The experiment key, matching the flagpole flag name without the
   * "organizations:" prefix (e.g. "my-experiment").
   */
  feature: string;
  /**
   * Whether to report that the user has been exposed to this experiment.
   * When true (the default), the hook will fire an exposure event on mount,
   * recording that the user has "seen" the experiment. Set to false when you
   * need to check the assignment without triggering exposure — for example,
   * to conditionally render a feature only if other criteria are also met.
   *
   * This option is reactive: changing it from false to true will report
   * exposure at that point.
   */
  reportExposure?: boolean;
}

/**
 * Open-source fallback: gates on organization.features with no exposure logging.
 */
function useNoopExperiment(options: UseExperimentOptions): UseExperimentResult {
  const organization = useOrganization();
  return {
    inExperiment: organization.features.includes(options.feature),
    experimentAssignment: 'control',
  };
}

/**
 * Check whether the current organization is enrolled in an experiment and
 * optionally report that the user has been exposed to it.
 *
 * Experiments are backed by flagpole feature flags with `experiment_mode`
 * set. The assignment ("active" or "control") is returned by the organization
 * details API in the `experiments` field.
 *
 * @param options.feature - The experiment key, matching the flagpole flag name
 *   without the "organizations:" prefix (e.g. "my-experiment").
 * @param options.reportExposure - Whether to log an exposure event. Defaults
 *   to true. Set to false to check the assignment without exposing the user.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {inExperiment} = useExperiment({feature: 'my-experiment'});
 *   if (!inExperiment) return null;
 *   return <NewFeature />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Defer exposure until the user actually interacts
 * function MyComponent() {
 *   const [opened, setOpened] = useState(false);
 *   const {inExperiment} = useExperiment({
 *     feature: 'my-experiment',
 *     reportExposure: opened,
 *   });
 *   // ...
 * }
 * ```
 */
export function useExperiment(options: UseExperimentOptions): UseExperimentResult {
  const useExperimentHook =
    HookStore.get('react-hook:use-experiment')[0] ?? useNoopExperiment;
  return useExperimentHook(options);
}
