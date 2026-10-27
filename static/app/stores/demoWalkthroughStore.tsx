import {createLegacyStore} from 'sentry/stores/createLegacyStore';
import {OnboardingTaskKey} from 'sentry/types/onboarding';

type State = {
  issueGuideAnchor: boolean;
  sidebarGuideAnchor: boolean;
};

const store = createLegacyStore<State>({
  issueGuideAnchor: false,
  sidebarGuideAnchor: false,
});

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
export const DemoWalkthroughStore = {
  ...store,

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
        return store.getState().issueGuideAnchor;
      case 'sidebar':
        return store.getState().sidebarGuideAnchor;
      default:
        return false;
    }
  },
};
