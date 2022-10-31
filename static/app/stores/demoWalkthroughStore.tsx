import {createStore, StoreDefinition} from 'reflux';

interface DemoWalkthroughStoreDefinition extends StoreDefinition {
  activateGuideAnchor(guide: string): void;
  deactivateGuideAnchor(guide: string): void;
  get(guide: string): boolean;
}

const storeConfig: DemoWalkthroughStoreDefinition = {
  issueGuideAnchor: false,
  sidebarGuideAnchor: false,
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },
  activateGuideAnchor(guide: string) {
    if (guide === 'issue') {
      this.issueGuideAnchor = true;
    }
    if (guide === 'sidebar') {
      this.sidebarGuideAnchor = true;
    }
    this.trigger(this.issueGuideAnchor, this.sidebarGuideAnchor);
  },
  deactivateGuideAnchor(guide: string) {
    if (guide === 'issue') {
      this.issueGuideAnchor = false;
    }
    if (guide === 'sidebar') {
      this.sidebarGuideAnchor = false;
    }
    this.trigger(this.issueGuideAnchor, this.sidebarGuideAnchor);
  },
  get(guide: string) {
    if (guide === 'issue') {
      return this.issueGuideAnchor;
    }
    if (guide === 'sidebar') {
      return this.sidebarGuideAnchor;
    }
    return false;
  },
};

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const DemoWalkthroughStore = createStore(storeConfig);
export default DemoWalkthroughStore;
