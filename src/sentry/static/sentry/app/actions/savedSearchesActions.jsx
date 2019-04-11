import Reflux from 'reflux';

export default Reflux.createActions([
  'fetchSavedSearches',
  'fetchSavedSearchesSuccess',
  'fetchSavedSearchesError',
  'createSavedSearchSuccess',
  'deleteSavedSearchSuccess',
  'pinSearch',
  'unpinSearch',
]);
