import {useStore} from 'zustand';
import {createStore} from 'zustand/vanilla';

export enum OnboardingDrawerKey {
  BROADCASTS = 'broadcasts',
  ONBOARDING_WIZARD = 'todos',
  SERVICE_INCIDENTS = 'statusupdate',
  PERFORMANCE_ONBOARDING = 'performance_onboarding',
  REPLAYS_ONBOARDING = 'replays_onboarding',
  PROFILING_ONBOARDING = 'profiling_onboarding',
  FEEDBACK_ONBOARDING = 'feedback_onboarding',
  FEATURE_FLAG_ONBOARDING = 'flag_onboarding',
}

interface OnboardingDrawerState {
  /**
   * The drawer panel that is open, or null when none is
   */
  readonly panel: OnboardingDrawerKey | null;
}

const store = createStore<OnboardingDrawerState>()(() => ({panel: null}));

export const OnboardingDrawerStore = {
  open(panel: OnboardingDrawerKey): void {
    store.setState({panel});
  },

  toggle(panel: OnboardingDrawerKey): void {
    store.setState(state => ({panel: state.panel === panel ? null : panel}));
  },

  close(): void {
    store.setState({panel: null});
  },
};

/**
 * Whether the onboarding drawer is open on `panel`. Only re-renders when that
 * panel opens or closes.
 */
export function useIsOnboardingDrawerOpen(panel: OnboardingDrawerKey): boolean {
  return useStore(store, state => state.panel === panel);
}
