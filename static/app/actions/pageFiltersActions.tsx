import Reflux from 'reflux';

import {PageFiltersStoreInterface} from 'sentry/stores/pageFiltersStore';

const PageFiltersActions = Reflux.createActions([
  'reset',
  'setOrganization',
  'initializeUrlState',
  'updateProjects',
  'updateDateTime',
  'updateEnvironments',
]) as {
  reset: PageFiltersStoreInterface['onReset'];
  setOrganization: PageFiltersStoreInterface['onSetOrganization'];
  initializeUrlState: PageFiltersStoreInterface['onInitializeUrlState'];
  updateProjects: PageFiltersStoreInterface['updateProjects'];
  updateDateTime: PageFiltersStoreInterface['updateDateTime'];
  updateEnvironments: PageFiltersStoreInterface['updateEnvironments'];
};

export default PageFiltersActions;
