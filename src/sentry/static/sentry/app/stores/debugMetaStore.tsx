import Reflux from 'reflux';

const DebugMetaActions = Reflux.createActions(['updateFilter']);

type State = {
  filter: string | null;
};

type DebugMetaStoreInterface = {
  init: () => void;
  reset: () => void;
  updateFilter: (word: string) => void;
  get: () => State;
};

type Internals = {
  filter: string | null;
};

const storeConfig: Reflux.StoreDefinition & DebugMetaStoreInterface & Internals = {
  filter: null,

  init() {
    this.reset();
    this.listenTo(DebugMetaActions.updateFilter, this.updateFilter);
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

const DebugMetaStore = Reflux.createStore(storeConfig);

export {DebugMetaActions, DebugMetaStore};
export default DebugMetaStore;
