import {createStore, StoreDefinition} from 'reflux';

type State = {
  filter: string | null;
};

interface DebugMetaStoreInterface extends StoreDefinition {
  get(): State;
  init(): void;
  reset(): void;
  updateFilter(word: string): void;
}

type Internals = {
  filter: string | null;
};

const storeConfig: StoreDefinition & DebugMetaStoreInterface & Internals = {
  filter: null,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.filter = null;
    this.trigger(this.get());
  },

  updateFilter(word) {
    this.filter = word;
    this.trigger(this.get());
  },

  get() {
    return {
      filter: this.filter,
    };
  },
};

const DebugMetaStore = createStore(storeConfig);

export {DebugMetaStore};
export default DebugMetaStore;
