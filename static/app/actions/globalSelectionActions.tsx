import Reflux from 'reflux';

const GlobalSelectionActions = Reflux.createActions([
  'reset',
  'setOrganization',
  'initializeUrlState',
  'updateProjects',
  'updateDateTime',
  'updateEnvironments',
  'save',
]);

export default GlobalSelectionActions;
