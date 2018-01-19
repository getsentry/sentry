import Reflux from 'reflux';
import FormSearchActions from '../actions/formSearchActions';

/**
 * Store for "form" searches, but probably will include more
 */
const FormSearchStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(FormSearchActions.addSearchMap, this.onAddSearchMap);
  },

  reset() {
    this.searchMap = {};
  },

  /**
   * Adds to search map
   *
   * @param Object searchIndex Map of search index -> object that includes route + field object
   */
  onAddSearchMap(searchMap) {
    Object.keys(searchMap).forEach(searchIndex => {
      this.searchMap[searchIndex] = searchMap[searchIndex];
    });
    this.trigger(this.searchMap);
  },

  get() {
    return this.searchMap;
  },
});

export default FormSearchStore;

window.test = FormSearchStore;
