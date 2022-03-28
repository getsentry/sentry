import Reflux from 'reflux';

import FormSearchActions from 'sentry/actions/formSearchActions';
import {FieldObject} from 'sentry/components/forms/type';
import {
  makeSafeRefluxStore,
  SafeRefluxStore,
  SafeStoreDefinition,
} from 'sentry/utils/makeSafeRefluxStore';

/**
 * Processed form field metadata.
 */
export type FormSearchField = {
  description: React.ReactNode;
  field: FieldObject;
  route: string;
  title: React.ReactNode;
};

type StoreInterface = {
  get(): Internals['searchMap'];
  reset(): void;
};

type Internals = {
  onLoadSearchMap: (searchMap: null | FormSearchField[]) => void;
  searchMap: null | FormSearchField[];
};

/**
 * Store for "form" searches, but probably will include more
 */
const storeConfig: Reflux.StoreDefinition &
  Internals &
  StoreInterface &
  SafeStoreDefinition = {
  searchMap: null,
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(
      this.listenTo(FormSearchActions.loadSearchMap, this.onLoadSearchMap)
    );
  },

  get() {
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

const FormSearchStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as unknown as SafeRefluxStore & StoreInterface;

export default FormSearchStore;
