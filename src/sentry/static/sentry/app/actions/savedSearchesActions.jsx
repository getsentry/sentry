import Reflux from 'reflux';

export default Reflux.createActions([
  'startFetchSavedSearches',
  'fetchSavedSearchesSuccess',
  'fetchSavedSearchesError',
  'createSavedSearchSuccess',
  'deleteSavedSearchSuccess',
  'pinSearch',
  'unpinSearch',
]);
