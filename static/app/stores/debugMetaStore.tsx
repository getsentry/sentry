import Reflux from 'reflux';

import {
  makeSafeRefluxStore,
  SafeRefluxStore,
  SafeStoreDefinition,
} from 'sentry/utils/makeSafeRefluxStore';

const DebugMetaActions = Reflux.createActions(['updateFilter']);

type State = {
  filter: string | null;
};

type DebugMetaStoreInterface = {
  get(): State;
  init(): void;
  reset(): void;
  updateFilter(word: string): void;
};

type Internals = {
  filter: string | null;
};

const storeConfig: Reflux.StoreDefinition &
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

const DebugMetaStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as unknown as SafeRefluxStore & DebugMetaStoreInterface;

export {DebugMetaActions, DebugMetaStore};
export default DebugMetaStore;
