import Reflux from 'reflux';

const PageFiltersActions = Reflux.createActions([
  'reset',
  'initializeUrlState',
  'updateProjects',
  'updateDateTime',
  'updateEnvironments',
  'pin',
]);

export default PageFiltersActions;
