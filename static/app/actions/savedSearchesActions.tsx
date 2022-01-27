import Reflux from 'reflux';

const SavedSearchActions = Reflux.createActions([
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

export default SavedSearchActions;
