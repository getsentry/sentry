import Reflux from 'reflux';

let PreferencesActions = Reflux.createActions([
  'loadInitialState',
  'hideSidebar',
  'showSidebar',
  'changeDashboard',
]);

export default PreferencesActions;
