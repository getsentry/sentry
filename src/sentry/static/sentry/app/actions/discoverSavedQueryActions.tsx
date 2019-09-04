import Reflux from 'reflux';

export default Reflux.createActions([
  'resetSavedQueries',
  'startFetchSavedQueries',
  'fetchSavedQueriesSuccess',
  'fetchSavedQueriesError',
  'createSavedQuerySuccess',
  'deleteSavedQuerySuccess',
  'updateSavedQuerySuccess',
]);
