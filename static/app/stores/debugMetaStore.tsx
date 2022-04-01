import {createActions, createStore, StoreDefinition} from 'reflux';

import {
  makeSafeRefluxStore,
  SafeRefluxStore,
  SafeStoreDefinition,
} from 'sentry/utils/makeSafeRefluxStore';

const DebugMetaActions = createActions(['updateFilter']);

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

const storeConfig: StoreDefinition &
  DebugMetaStoreInterface &
  Internals &
  SafeStoreDefinition = {
  filter: null,
  unsubscribeListeners: [],

  init() {
    this.reset();

    this.unsubscribeListeners.push(
      this.listenTo(DebugMetaActions.updateFilter, this.updateFilter)
    );
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

const DebugMetaStore = createStore(makeSafeRefluxStore(storeConfig)) as SafeRefluxStore &
  DebugMetaStoreInterface;

export {DebugMetaActions, DebugMetaStore};
export default DebugMetaStore;
