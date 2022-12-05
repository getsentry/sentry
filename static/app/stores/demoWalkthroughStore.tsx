import {createStore, StoreDefinition} from 'reflux';

import {OnboardingTaskKey} from 'sentry/types';

interface DemoWalkthroughStoreDefinition extends StoreDefinition {
  activateGuideAnchor(guide: string): void;
  get(guide: string): boolean;
}

const storeConfig: DemoWalkthroughStoreDefinition = {
  issueGuideAnchor: false,
  sidebarGuideAnchor: false,
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },

  activateGuideAnchor(task: OnboardingTaskKey) {
    switch (task) {
      case OnboardingTaskKey.ISSUE_GUIDE:
        this.issueGuideAnchor = true;
        this.trigger(this.issueGuideAnchor);
        break;
      case OnboardingTaskKey.SIDEBAR_GUIDE:
        this.sidebarGuideAnchor = true;
        this.trigger(this.sidebarGuideAnchor);
        break;
      default:
    }
  },

  get(guide: string) {
    switch (guide) {
      case 'issue':
        return this.issueGuideAnchor;
      case 'sidebar':
        return this.sidebarGuideAnchor;
      default:
        return false;
    }
  },
};

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const DemoWalkthroughStore = createStore(storeConfig);
export default DemoWalkthroughStore;
