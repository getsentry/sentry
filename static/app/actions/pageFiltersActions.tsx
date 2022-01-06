import Reflux from 'reflux';

const PageFiltersActions = Reflux.createActions([
  'reset',
  'setOrganization',
  'initializeUrlState',
  'updateProjects',
  'updateDateTime',
  'updateEnvironments',
  'save',
]);

export default PageFiltersActions;
