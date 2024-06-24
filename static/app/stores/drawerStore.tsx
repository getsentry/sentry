import {createStore} from 'reflux';

import type {DrawerOptions, DrawerRenderProps} from 'sentry/components/globalDrawer';

import type {StrictStoreDefinition} from './types';

type DrawerRenderer = (renderProps: DrawerRenderProps) => React.ReactNode;

type State = {
  options: DrawerOptions;
  renderer: DrawerRenderer | null;
};

interface SidePanelStoreDefinition extends StrictStoreDefinition<State> {
  closeDrawer(): void;
  init(): void;
  openDrawer(renderer: DrawerRenderer, options: DrawerOptions): void;
  reset(): void;
}

const storeConfig: SidePanelStoreDefinition = {
  state: {renderer: null, options: {}},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
    this.reset();
  },

  getState() {
    return this.state;
  },

  reset() {
    this.state = {
      renderer: null,
      options: {},
    };
  },

  closeDrawer() {
    this.reset();
    this.trigger(this.state);
  },

  openDrawer(renderer: DrawerRenderer, options: DrawerOptions) {
    this.state = {renderer, options};
    this.trigger(this.state);
  },
};

const DrawerStore = createStore(storeConfig);
export default DrawerStore;
