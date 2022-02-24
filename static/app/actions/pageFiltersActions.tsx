import Reflux from 'reflux';

const PageFiltersActions = Reflux.createActions([
  'reset',
  'initializeUrlState',
  'updateProjects',
  'updateDateTime',
  'updateEnvironments',
  'updateDesyncedFilters',
  'pin',
]);

export default PageFiltersActions;
