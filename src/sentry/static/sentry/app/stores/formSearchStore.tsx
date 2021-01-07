import Reflux from 'reflux';

import FormSearchActions from 'app/actions/formSearchActions';
import {FieldObject} from 'app/views/settings/components/forms/type';

/**
 * Processed form field metadata.
 */
export type FormSearchField = {
  route: string;
  title: React.ReactNode;
  description: React.ReactNode;
  field: FieldObject;
};

type StoreInterface = {
  reset: () => void;
};

type Internals = {
  searchMap: null | FormSearchField[];
  onLoadSearchMap: (searchMap: null | FormSearchField[]) => void;
};

/**
 * Store for "form" searches, but probably will include more
 */
const formSearchStoreConfig: Reflux.StoreDefinition & Internals & StoreInterface = {
  searchMap: null,

  init() {
    this.reset();
    this.listenTo(FormSearchActions.loadSearchMap, this.onLoadSearchMap);
  },

  getInitialState() {
    return this.searchMap;
  },

  reset() {
    // `null` means it hasn't been loaded yet
    this.searchMap = null;
  },

  /**
   * Adds to search map
   */
  onLoadSearchMap(searchMap) {
    // Only load once
    if (this.searchMap !== null) {
      return;
    }

    this.searchMap = searchMap;
    this.trigger(this.searchMap);
  },
};

type FormSearchStore = Reflux.Store & StoreInterface;

export default Reflux.createStore(formSearchStoreConfig) as FormSearchStore;
