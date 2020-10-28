import Reflux from 'reflux';

export default Reflux.createActions([
  'resetSavedSearches',
  'startFetchSavedSearches',
  'fetchSavedSearchesSuccess',
  'fetchSavedSearchesError',
  'createSavedSearchSuccess',
  'deleteSavedSearchSuccess',
  'pinSearch',
  'pinSearchSuccess',
  'unpinSearch',
]);
