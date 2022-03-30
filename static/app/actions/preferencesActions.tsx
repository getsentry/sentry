import {createActions} from 'reflux';

const PreferencesActions = createActions([
  'loadInitialState',
  'hideSidebar',
  'showSidebar',
]);

export default PreferencesActions;
