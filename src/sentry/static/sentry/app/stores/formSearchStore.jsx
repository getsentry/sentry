import Reflux from 'reflux';

import FormSearchActions from 'app/actions/formSearchActions';

/**
 * Store for "form" searches, but probably will include more
 */
const FormSearchStore = Reflux.createStore({
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
   *
   * @param {Array} searchMap array of objects: {route, field}
   */
  onLoadSearchMap(searchMap) {
    // Only load once
    if (this.searchMap !== null) {
      return;
    }

    this.searchMap = searchMap;
    this.trigger(this.searchMap);
  },
});

export default FormSearchStore;
