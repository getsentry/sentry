import {createStore} from 'reflux';

import type {StrictStoreDefinition} from './types';

type ActivePanelType = Readonly<OnboardingDrawerKey | ''>;

interface OnboardingDrawerStoreDefinition extends StrictStoreDefinition<ActivePanelType> {
  close(hash?: string): void;

  open(panel: OnboardingDrawerKey): void;
  toggle(panel: OnboardingDrawerKey): void;
}

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

const storeConfig: OnboardingDrawerStoreDefinition = {
  state: '',

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },

  open(panel: OnboardingDrawerKey) {
    this.state = panel;
    this.trigger(this.state);
  },

  toggle(panel: OnboardingDrawerKey) {
    if (this.state === panel) {
      this.close();
    } else {
      this.open(panel);
    }
  },

  close(hash?: string) {
    this.state = '';

    if (hash) {
      window.location.hash = window.location.hash.replace(`#${hash}`, '');
    }

    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },
};

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const OnboardingDrawerStore = createStore(storeConfig);
export default OnboardingDrawerStore;
