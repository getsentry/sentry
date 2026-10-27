import {Store} from '@tanstack/react-store';

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

const store = new Store<ActivePanelType>('');

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
export const OnboardingDrawerStore = {
  store,

  getState() {
    return store.state;
  },

  init() {},

  open(panel: OnboardingDrawerKey) {
    store.setState(() => panel);
  },

  toggle(panel: OnboardingDrawerKey) {
    if (store.state === panel) {
      OnboardingDrawerStore.close();
    } else {
      OnboardingDrawerStore.open(panel);
    }
  },

  close() {
    store.setState(() => '');
  },
};
