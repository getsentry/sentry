import {Store} from '@tanstack/react-store';

import {OnboardingTaskKey} from 'sentry/types/onboarding';

type State = {
  issueGuideAnchor: boolean;
  sidebarGuideAnchor: boolean;
};

const store = new Store<State>({
  issueGuideAnchor: false,
  sidebarGuideAnchor: false,
});

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
export const DemoWalkthroughStore = {
  store,

  getState() {
    return store.state;
  },

  activateGuideAnchor(task: OnboardingTaskKey) {
    switch (task) {
      case OnboardingTaskKey.ISSUE_GUIDE:
        store.setState(prev => ({...prev, issueGuideAnchor: true}));
        break;
      case OnboardingTaskKey.SIDEBAR_GUIDE:
        store.setState(prev => ({...prev, sidebarGuideAnchor: true}));
        break;
      default:
    }
  },

  get(guide: string) {
    switch (guide) {
      case 'issue':
        return store.state.issueGuideAnchor;
      case 'sidebar':
        return store.state.sidebarGuideAnchor;
      default:
        return false;
    }
  },
};
