import {createActions} from 'reflux';

const PageFiltersActions = createActions([
  'reset',
  'initializeUrlState',
  'updateProjects',
  'updateDateTime',
  'updateEnvironments',
  'updateDesyncedFilters',
  'pin',
]);

export default PageFiltersActions;
