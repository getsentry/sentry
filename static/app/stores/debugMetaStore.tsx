import {createStore} from 'reflux';

import type {StrictStoreDefinition} from 'sentry/stores/types';

type State = string | null;

interface DebugMetaStoreInterface extends StrictStoreDefinition<State> {
  get(): {filter: State};
  init(): void;
  reset(): void;
  updateFilter(word: string): void;
}

const storeConfig: DebugMetaStoreInterface = {
  state: null,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = null;
    this.trigger(this.get());
  },

  updateFilter(word) {
    this.state = word;
    this.trigger(this.get());
  },

  get() {
    return {
      filter: this.state,
    };
  },

  getState() {
    return this.state;
  },
};

const DebugMetaStore = createStore(storeConfig);

export default DebugMetaStore;
