import {createStore} from 'zustand';

type ActivePanelType = Readonly<OnboardingDrawerKey | ''>;

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

const store = createStore<ActivePanelType>()(() => '');

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
export const OnboardingDrawerStore = {
  ...store,

  init() {},

  open(panel: OnboardingDrawerKey) {
    store.setState(panel, true);
  },

  toggle(panel: OnboardingDrawerKey) {
    if (store.getState() === panel) {
      OnboardingDrawerStore.close();
    } else {
      OnboardingDrawerStore.open(panel);
    }
  },

  close() {
    store.setState('', true);
  },
};
