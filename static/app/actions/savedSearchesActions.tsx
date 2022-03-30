import {createActions} from 'reflux';

const SavedSearchActions = createActions([
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
